import argparse
import websockets
import asyncio
import requests


Q = asyncio.Queue()


class Pump(asyncio.DatagramProtocol):
    def __init__(self, target) -> None:
        super().__init__()
        self.target = target

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        self.target = addr
        message = data.decode()
        Q.put_nowait(message)

    def error_received(self, exc):
        print("Managed Exception - ", exc)

    def pipe_data(self, data):
        if self.target[-1] is None:
            return
        self.transport.sendto(data, self.target)


async def outbound(websocket):
    try:
        while websocket.close_code is None:
            await websocket.send(await Q.get())
    except asyncio.CancelledError:
        return


async def main(arg_ns: argparse.Namespace):
    ws_sch = "ws" if arg_ns.insecure else "wss"
    http_sch = "http" if arg_ns.insecure else "https"
    ws_fmt = ws_sch + "://" + arg_ns.server + "%s/ws"
    alloc_url = http_sch + "://" + arg_ns.server + "allocate"
    pid = arg_ns.id
    if arg_ns.alloc:
        alloc = requests.get(alloc_url).json()
        if not alloc['success']:
            raise Exception(alloc['error'])
        pid = alloc['pid']
        print("Allocated web pipe [ %s ]." % pid)
    loop = asyncio.get_running_loop()
    transport, pump = await loop.create_datagram_endpoint(
        lambda: Pump((arg_ns.target_ip, arg_ns.target_port)),
        local_addr=('127.0.0.1', arg_ns.port),
        allow_broadcast=True
    )
    future = None
    try:
        async with websockets.connect(ws_fmt % pid) as websocket:
            print("Connected to web pipe [ %s ]." % pid)
            future = asyncio.ensure_future(outbound(websocket))
            while websocket.close_code is None:
                data = await websocket.recv()
                pump.pipe_data(data)
    finally:
        if future is not None:
            future.cancel()
        print("Ended. Cleaning up.")
        transport.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Client for connecting SKIS web pipe to local udp port.")
    parser.add_argument("--server", type=str, default="localhost:5000/webpipe/", help="SKIS web pipe base address.")
    parser.add_argument("--id", type=str, default=None, help="Web pipe UUID. Ignored if --alloc is set.")
    parser.add_argument("--alloc", action="store_true", help="Whether to allocate new web pipe.")
    parser.add_argument("--insecure", action="store_true", help="Do not use https/wss.")
    parser.add_argument(
        "--target_ip", type=str, default="127.0.0.1",
        help="Default IP address to pump web pipe flow into. " +
        "On receiving packets from UDP port, it will pump into the transmitter thereafter."
    )
    parser.add_argument(
        "--target_port", type=int, default=None,
        help="Default UDP port to pump web pipe flow into. None for suppressing." +
        "On receiving packets from UDP port, it will pump into the transmitter thereafter."
    )
    parser.add_argument(
        "--port", type=int, default=35487,
        help="Local UDP port of the web pipe end."
    )
    arg_ns = parser.parse_args()
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main(arg_ns))
    loop.close()
