import subprocess
import sys
import time
import requests
import queue
import threading
from urllib.parse import urljoin


R = queue.Queue()
url_base = sys.argv[-1]
stop_web_comm = False


def web_comm_recv():
    while not stop_web_comm:
        data = requests.get(urljoin(url_base, "stream")).json()
        for item in data:
            R.put(item)
        time.sleep(0.3)


def web_comm_send(proc):
    while not stop_web_comm:
        for r in iter(proc.stdout.readline, ''):
            requests.post(urljoin(url_base, "stream"), json={
                "data": r
            }).json()


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
            if cmdexec == 'quit':
                raise KeyboardInterrupt
            try:
                proc = subprocess.Popen(
                    cmdexec, shell=True, universal_newlines=True, bufsize=0,
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT
                )
                comm = (
                    threading.Thread(target=web_comm_recv, daemon=True),
                    threading.Thread(target=web_comm_send, daemon=True, args=(proc,))
                )
                comm[0].start(); comm[1].start()
                while proc.poll() is None:
                    while not R.empty():
                        inline = R.get()
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
