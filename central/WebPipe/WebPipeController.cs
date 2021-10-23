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
        [HttpGet("/webpipe/debug/info")]
        public IEnumerable<WebPipeDebugItem> DebugInfo()
        {
            return _webPipeService.WebPipes.Select((x) => new WebPipeDebugItem {
                pid = x.Key,
                numParticipants = x.Value.ParticipantCount
            });
        }

        [HttpGet("/webpipe/allocate")]
        public WebPipeAllocationResult Allocate()
        {
            var pipe = _webPipeService.Allocate();
            TimeoutWebPipeInitialization(_logger, _webPipeService, pipe.pid);
            return new WebPipeAllocationResult
            {
                pid = pipe.pid,
                success = true,
                error = null
            };
        }

        public static async void TimeoutWebPipeInitialization(ILogger<WebPipeController> logger, WebPipeService service, Guid pid)
        {
            await Task.Delay(30000);
            if (service.WebPipes.TryGetValue(pid, out var pipe) && pipe.ParticipantCount == 0)
            {
                logger.LogInformation($"Freeing web pipe {pid} due to timeout.");
                service.TryFree(pipe);
            }
        }

        volatile bool _closed = false;

        [HttpGet("/webpipe/{pid:guid}/ws")]
        public async Task HandleWebSocket(Guid pid)
        {
            if (HttpContext.WebSockets.IsWebSocketRequest
            && _webPipeService.WebPipes.TryGetValue(pid, out var pipe))
            {
                using var ws = await HttpContext.WebSockets.AcceptWebSocketAsync();
                var me = pipe.NewConnection();
                var outbound = _handleWebSocketOutbound(HttpContext, ws, me);
                var buffer = new byte[1024 * 16];
                while (true)
                {
                    var result = await ws.ReceiveAsync(new Memory<byte>(buffer), CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close) break;
                    await _handleWebSocketInbound(buffer, result, me);
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

        private async Task _handleWebSocketOutbound(HttpContext ctx, WebSocket ws, WebPipe.Participant me)
        {
            while (!_closed)
            {
                var buf = await me.PollOrNull(500);
                if (buf != null)
                {
                    await ws.SendAsync(
                        new Memory<byte>(buf),
                        WebSocketMessageType.Binary, 
                        true, CancellationToken.None
                    );
                }
            }
        }

        private async Task _handleWebSocketInbound(Memory<byte> buffer, ValueWebSocketReceiveResult result, WebPipe.Participant me)
        {
            await me.Broadcast(buffer.ToArray());
        }
    }
}
