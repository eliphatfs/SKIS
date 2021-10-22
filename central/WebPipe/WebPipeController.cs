using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace SKIS.Central.WebPipe
{
    [ApiController]
    public class WebPipeController : ControllerBase
    {

        private readonly ILogger<WebPipeController> _logger;
        private readonly WebPipeService _webPipeService;

        public WebPipeController(ILogger<WebPipeController> logger, WebPipeService webPipeService)
        {
            _logger = logger;
            _webPipeService = webPipeService;
        }

        volatile bool _closed = false;

        [HttpGet("/webpipe/ws")]
        public async Task HandleWebSocket()
        {
            if (HttpContext.WebSockets.IsWebSocketRequest)
            {
                using var ws = await HttpContext.WebSockets.AcceptWebSocketAsync();
                var outbound = _handleWebSocketOutbound(HttpContext, ws);
                var buffer = new byte[1024 * 16];
                while (true)
                {
                    var result = await ws.ReceiveAsync(new Memory<byte>(buffer), CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close) break;
                    await _handleWebSocketInbound(buffer, result);
                }
                _closed = true;  // ATOM BY C#
                await outbound;
                await ws.CloseAsync(ws.CloseStatus ?? WebSocketCloseStatus.NormalClosure, ws.CloseStatusDescription, CancellationToken.None);
            }
            else
            {
                HttpContext.Response.StatusCode = (int)HttpStatusCode.BadRequest;
            }
        }

        private async Task _handleWebSocketOutbound(HttpContext ctx, WebSocket ws)
        {
            while (!_closed)
            {
                await Task.Delay(1);  // STUB
            }
        }

        private async Task _handleWebSocketInbound(Memory<byte> buffer, ValueWebSocketReceiveResult result)
        {
        }
    }
}
