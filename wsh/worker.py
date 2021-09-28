import subprocess
import sys
import time
import requests
from urllib.parse import urljoin


if __name__ == "__main__":
    try:
        url_base = sys.argv[-1]
        while True:
            cmd = requests.get(urljoin(url_base, "get_cmd")).json()
            cmdid, cmdexec = cmd['uuid'], cmd['exec']
            if cmdexec == 'quit':
                raise KeyboardInterrupt
            try:
                proc = subprocess.Popen(
                    cmdexec, shell=True, text=True,
                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT
                )
                buf = ""
                while proc.poll() is None:
                    time.sleep(0.2)
                    buf += proc.stdout.read(-1)
                    if buf:
                        requests.post(urljoin(url_base, "stream"), json={
                            "uuid": cmdid,
                            "data": buf
                        }).json()
                        buf = ""
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
