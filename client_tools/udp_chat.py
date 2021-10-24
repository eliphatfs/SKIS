import argparse
import socket
import threading


def recv_thd(sock):
    while True:
        print(sock.recv(16384).decode(), end='')


def main(arg_ns: argparse.Namespace):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    target = arg_ns.target_ip, arg_ns.target_port
    sock.sendto(b'', target)
    if arg_ns.name:
        sock.sendto(("Joined: " + arg_ns.name + "\n").encode(), target)
    threading.Thread(target=recv_thd, daemon=True, args=(sock,)).start()
    try:
        while True:
            c = input()
            if c == '$quit':
                break
            if arg_ns.name:
                sock.sendto((arg_ns.name + ": ").encode(), target)
            sock.sendto((c + "\n").encode(), target)
    except KeyboardInterrupt:
        pass
    finally:
        if arg_ns.name:
            sock.sendto(("Left: " + arg_ns.name + "\n").encode(), target)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Tool for basic text transmission via UDP.")
    parser.add_argument("--target_ip", type=str, default="127.0.0.1", help="IP address to communicate with")
    parser.add_argument("--target_port", type=int, default=35487, help="UDP port to communicate with.")
    parser.add_argument("--name", type=str, default=None, help="Name to display in chat.")
    main(parser.parse_args())
