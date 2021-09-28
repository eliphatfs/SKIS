import aiohttp.web as web
import asyncio
import uuid
import threading


routes = web.RouteTableDef()
input_lines = []


def input_thread():
    while True:
        input_lines.append(input())


@routes.get('/get_cmd')
async def get_cmd(request):
    print("$ ", end='', flush=True)
    while not input_lines:
        await asyncio.sleep(0.01)
    cmd = input_lines.pop(0)
    cid = str(uuid.uuid4())
    return web.json_response({
        "uuid": cid,
        "exec": cmd
    })


@routes.post('/stream')
async def stream_post(request):
    data = await request.json()
    print(data['data'], end='')
    return web.json_response({})


@routes.get('/stream')
async def stream_get(request):
    input_buf = list(input_lines)
    input_lines.clear()
    return web.json_response(input_buf)


@routes.post('/result')
async def stream(request):
    data = await request.json()
    print("Done:", data['result'])
    return web.json_response({})


if __name__ == "__main__":
    print("Starting...")
    threading.Thread(target=input_thread, daemon=True).start()
    app = web.Application()
    app.router.add_routes(routes)
    web.run_app(app, host="127.0.0.1", port=35487)
