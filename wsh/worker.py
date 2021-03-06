import subprocess
import sys
import time
import requests
import queue
import threading
from urllib.parse import urljoin
import signal
import os


R = queue.Queue()
url_base = sys.argv[-1]
stop_web_comm = False


def web_comm_recv():
    while not stop_web_comm:
        data = requests.get(urljoin(url_base, "stream")).json()
        for item in data:
            R.put(item)
        time.sleep(0.3)


def web_comm_send():
    with open("tmp.log", "r", 1) as r:
        while not stop_web_comm:
            d = r.read()
            if d:
                requests.post(urljoin(url_base, "stream"), json={
                    "data": d
                }).json()
            time.sleep(0.2)


def shell_command(com: str):
    if not com:
        return True
    d = com.split(maxsplit=2)
    if d[0] == 'cd':
        if len(d) > 1:
            os.chdir(d[1])
            requests.post(urljoin(url_base, "result"), json={
                "result": "OK"
            }).json()
            return True
    if d[0] in {'ls', 'echo', 'cd', 'df', 'du'}:
        result = subprocess.check_output(com, shell=True, stderr=subprocess.STDOUT, universal_newlines=True)
        requests.post(urljoin(url_base, "result"), json={
            "result": result
        }).json()
        return True
    if d[0] == 'quit':
        raise KeyboardInterrupt
    return False


def lex(com: str):
    s = []
    stage = []
    quote_on = False
    for c in com:
        if c == ' ' and not quote_on:
            if stage:
                s.append(''.join(stage)); stage = []
        elif c == '"':
            quote_on = not quote_on
        else:
            stage.append(c)
    if stage:
        s.append(''.join(stage))
    return s


def work():
    global stop_web_comm
    try:
        comm = None
        while True:
            stop_web_comm = True
            if comm is not None:
                comm[0].join(); comm[1].join()
                comm = None
            stop_web_comm = False
            cmd = requests.get(urljoin(url_base, "get_cmd")).json()
            cmdid, cmdexec = cmd['uuid'], cmd['exec']
            try:
                if shell_command(cmdexec):
                    continue
                fil = open("tmp.log", "w", 1)
                proc = subprocess.Popen(
                    lex(cmdexec), shell=False, universal_newlines=True, bufsize=0,
                    stdin=subprocess.PIPE, stdout=fil, stderr=fil
                )
                comm = (
                    threading.Thread(target=web_comm_recv, daemon=True),
                    threading.Thread(target=web_comm_send, daemon=True)
                )
                comm[0].start(); comm[1].start()
                while proc.poll() is None:
                    while not R.empty():
                        inline = R.get()
                        if inline == "SIGINT":
                            proc.send_signal(signal.SIGINT)
                            continue
                        proc.stdin.write(inline)
                        proc.stdin.write("\n")
                        proc.stdin.flush()
                    time.sleep(0.2)
                requests.post(urljoin(url_base, "result"), json={
                    "uuid": cmdid,
                    "result": "exit code %d" % proc.poll()
                }).json()
            except Exception as exc:
                requests.post(urljoin(url_base, "result"), json={
                    "uuid": cmdid,
                    "result": repr(exc)
                }).json()
    except KeyboardInterrupt:
        print("SKIS - WSH worker exit.")
    except Exception as exc:
        print("SKIS - WSH worker error.")
        raise


if __name__ == "__main__":
    work()
