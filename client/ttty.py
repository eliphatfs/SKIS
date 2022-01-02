import urllib.request
import urllib.parse
import websockets
import argparse
import asyncio
import shutil
import tqdm
import os
import sys
import json
import random
import logging
import platform
import subprocess
from Cryptodome.Cipher import AES
from Cryptodome.Protocol.KDF import PBKDF2
from Cryptodome.Hash import SHA512


def local_path_of(file):
    return os.path.join(os.path.dirname(__file__), file)


class DownloadProgressBar(tqdm.tqdm):
    def update_to(self, b=1, bsize=1, tsize=None):
        if tsize is not None:
            self.total = tsize
        self.update(b * bsize - self.n)


def download_url(url, output_path):
    with DownloadProgressBar(
        unit='B', unit_scale=True,
        miniters=1, desc=url.split('/')[-1]
    ) as t:
        urllib.request.urlretrieve(url, filename=output_path, reporthook=t.update_to)


def post_url(url, data):
    data = urllib.parse.urlencode(data)
    data = data.encode('ascii')
    with urllib.request.urlopen(url, data) as f:
        return f.read().decode('utf-8')


def yes_or_no():
    while True:
        read = input().lower()
        if read not in ['y', 'n']:
            print("Please answer `y` or `n`.")
        else:
            return read == 'y'


def prepare_ttyd():
    print("OS:", platform.system())
    print("Arch:", platform.machine())
    if os.path.exists(local_path_of("ttyd")):
        print("Using local ttyd in script directory")
        return local_path_of("ttyd")
    if os.path.exists(local_path_of("ttyd.exe")):
        print("Using local ttyd.exe in script directory")
        return local_path_of("ttyd.exe")
    which_result = shutil.which("ttyd")
    if which_result is not None:
        print("Using ttyd in path:", which_result)
        return which_result
    if platform.system().lower() == 'darwin':
        print(
            "You need to install ttyd on MacOS.",
            "In most cases running `brew install ttyd` is enough."
        )
    if platform.machine().lower() in ['amd64', 'x86_64', 'x64', 'x86-64']:
        uri = None
        if platform.system().lower() == 'windows':
            uri = "https://skis.flandre.info/d/ttyd/win10-x64/ttyd.exe"
        if platform.system().lower() == 'linux':
            uri = "https://skis.flandre.info/d/ttyd/linux-x64/ttyd"
        print("Fetching ttyd from SKIS...")
        if uri is not None:
            download_url(uri, local_path_of(local_path_of("ttyd.exe")))
            return prepare_ttyd()
    print(
        "Cannot resolve ttyd.",
        "Please install it in PATH or put the executable next to this script."
    )
    # TODO: move fallback implementation from legacy wsh to here.
    '''print(
        "ttyd not available, use fallback implementation without pty?",
        "(Advanced behaviours such as colored text and arrow keys will be unavailable)",
        "[y/n]"
    )
    if yes_or_no():
        return None
    else:
        raise SystemExit()'''


def protocol_decode(data, pswd):
    nonce, ciphertext, tag = data[:16], data[16: -16], data[-16:]
    cipher = AES.new(pswd, AES.MODE_EAX, nonce=nonce)
    try:
        return cipher.decrypt_and_verify(ciphertext, tag)
    except ValueError as exc:
        print("Got", exc)
        print(
            "Corrupt data or unauthorized transmission (possibly wrong password)."
            "Discarding packet."
        )
        return None


def protocol_encode(data, pswd):
    cipher = AES.new(pswd, AES.MODE_EAX)
    nonce = cipher.nonce
    ciphertext, tag = cipher.encrypt_and_digest(data)
    return nonce + ciphertext + tag


async def ttyd2skis(ttyd_pipe, skis_pipe, pswd):
    while ttyd_pipe.close_code is None and skis_pipe.close_code is None:
        data = await ttyd_pipe.recv()
        if data[0] == b'0'[0]:
            data = data[1:]
            n = 15 * 1024
            chunks = [data[i: i+n] for i in range(0, len(data), n)]
            for chunk in chunks:
                await skis_pipe.send(protocol_encode(chunk, pswd))


async def skis2ttyd(ttyd_pipe, skis_pipe, pswd, first_msg=False):
    while ttyd_pipe.close_code is None and skis_pipe.close_code is None:
        data = await skis_pipe.recv()
        cmd = protocol_decode(data, pswd)
        if cmd is None:
            continue
        if first_msg:
            return cmd
        await ttyd_pipe.send(cmd)


async def main(arg_ns: argparse.Namespace):
    ws_sch = "ws" if arg_ns.insecure else "wss"
    http_sch = "http" if arg_ns.insecure else "https"
    ws_fmt = ws_sch + "://" + arg_ns.server + "%s/ws"
    alloc_url = http_sch + "://" + arg_ns.server + "allocate"
    if os.getenv("TTTY_PASS") is None:
        print("Please set a password in TTTY_PASS environment variable.")
        raise SystemExit()
    ttyd = prepare_ttyd()
    print("Allocating SKIS ttty resource...")
    alloc = json.loads(post_url(alloc_url, {"name": arg_ns.name, "capabilities": 2}))
    if not alloc['success']:
        raise Exception(alloc['error'])
    print("Allocated:", arg_ns.name, alloc['pid'])
    pswd = PBKDF2(
        os.getenv("TTTY_PASS"), alloc['pid'][:16].encode("ascii"),
        24, 1000, hmac_hash_module=SHA512
    )
    ttyd_proc = subprocess.Popen([ttyd, '-p', '35781', '-d', '32767', arg_ns.spawn])
    futures = []
    try:
        async with websockets.connect(ws_fmt % alloc['pid']) as skis_pipe:
            first_msg = await skis2ttyd(skis_pipe, skis_pipe, pswd, True)
            async with websockets.connect('ws://127.0.0.1:35781/ws', subprotocols=['tty']) as ttyd_pipe:
                await ttyd_pipe.send(first_msg)
                futures.append(asyncio.ensure_future(ttyd2skis(ttyd_pipe, skis_pipe, pswd)))
                futures.append(asyncio.ensure_future(skis2ttyd(ttyd_pipe, skis_pipe, pswd)))
                while skis_pipe.close_code is None and ttyd_pipe.close_code is None:
                    await asyncio.sleep(0.1)
    finally:
        for future in futures:
            future.cancel()
        print("Ended. Cleaning up.")
        ttyd_proc.terminate()
    sys.exit()


DESC = """Client for serving a terminal over SKIS web pipe.
You will need to set a password in TTTY_PASS environment variable before running this script.
"""


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=DESC)
    parser.add_argument("--server", type=str, default="central.skis.flandre.info/webpipe/", help="SKIS web pipe base address.")
    parser.add_argument("--spawn", type=str, default="bash", help="The command to run on login.")
    parser.add_argument("--name", type=str, default='ttty' + str(random.randint(0, 2 ** 24)), help="Friendly display name of this ttty.")
    parser.add_argument("--insecure", action="store_true", help="Do not use https/wss.")
    arg_ns = parser.parse_args()
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main(arg_ns))
    loop.close()
