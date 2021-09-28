import aiohttp.web as web
import uuid


routes = web.RouteTableDef()


@routes.get('/get_cmd')
async def get_cmd(request):
    cmd = input("$ ")
    cid = str(uuid.uuid4())
    return web.json_response({
        "uuid": cid,
        "exec": cmd
    })


@routes.post('/stream')
async def stream(request):
    data = await request.json()
    print(data['data'], end='')
    return web.json_response({})


@routes.post('/result')
async def stream(request):
    data = await request.json()
    print("Done:", data['result'])
    return web.json_response({})


if __name__ == "__main__":
    print("Starting...")
    app = web.Application()
    app.router.add_routes(routes)
    web.run_app(app, host="127.0.0.1", port=35487)
