import platform
import websockets
import requests
import asyncio
import argparse
import shutil


def platform_detect():
    print("OS:", platform.system())
    print("Arch:", platform.machine())
    print("ttyd:", shutil.which("ttyd"))


async def main(arg_ns: argparse.Namespace):
    platform_detect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Client for serving a terminal over SKIS web pipe.")
    arg_ns = parser.parse_args()
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main(arg_ns))
    loop.close()
