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
using SKIS.Central.ASPNetAddons;

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

        [HttpGet("/webpipe/query")]
        public IEnumerable<WebPipeQueryResult> QueryWebPipes([FromQuery] int requireCap = 0)
        {
            var cap = (WebPipeCapabilities)requireCap;
            foreach (var pipekv in _webPipeService.WebPipes)
            {
                if (pipekv.Value.capabilities.HasFlag(cap))
                    yield return new WebPipeQueryResult
                    {
                        capabilities = pipekv.Value.capabilities,
                        key = pipekv.Key,
                        pid = pipekv.Value.pid,
                        name = pipekv.Value.name,
                        numMessages = pipekv.Value.MessageCount,
                        numParticipants = pipekv.Value.ParticipantCount
                    };
            }
        }

        [HttpPost("/webpipe/allocate")]
        public WebPipeAllocationResult AllocatePost([FromForm] string name = null, [FromForm] int capabilities = 0)
        {
            if (capabilities < 0 || capabilities >= (int)WebPipeCapabilities.Overflow)
                throw new HttpException(HttpStatusCode.BadRequest, "Capabilities out of range: " + capabilities);
            if (name != null && name.Length >= 64)
                throw new HttpException(HttpStatusCode.BadRequest, "Name too long");
            var pipe = _webPipeService.Allocate();
            TimeoutWebPipeInitialization(_logger, _webPipeService, pipe.pid);
            pipe.capabilities = (WebPipeCapabilities)capabilities;
            if (!string.IsNullOrWhiteSpace(name))
                pipe.name = name;
            return new WebPipeAllocationResult
            {
                pid = pipe.pid,
                success = true,
                error = null
            };
        }

        [HttpGet("/webpipe/allocate")]
        public WebPipeAllocationResult AllocateGet()
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
                try
                {
                    while (true)
                    {
                        var result = await ws.ReceiveAsync(new Memory<byte>(buffer), CancellationToken.None);
                        if (result.MessageType == WebSocketMessageType.Close) break;
                        await _handleWebSocketInbound(new Memory<byte>(buffer, 0, result.Count), result, me);
                    }
                    _closed = true;  // ATOM BY C#
                    await outbound;
                    await ws.CloseAsync(ws.CloseStatus ?? WebSocketCloseStatus.NormalClosure, ws.CloseStatusDescription, CancellationToken.None);
                }
                catch (WebSocketException wse)
                {
                    if (wse.WebSocketErrorCode != WebSocketError.ConnectionClosedPrematurely)
                        _logger.LogWarning(wse, "Unexepected web pipe exception.");
                }
                finally
                {
                    _closed = true;
                    me.Close();
                }
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
