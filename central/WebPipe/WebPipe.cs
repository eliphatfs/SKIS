using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using System.Threading.Tasks.Dataflow;
using SKIS.Central.ASPNetAddons;

namespace SKIS.Central.WebPipe
{
    public class WebPipe
    {
        public class Participant
        {
            private WebPipe _webPipe;
            private BufferBlock<byte[]> _messageBuffer;
            public Participant(WebPipe webPipe)
            {
                _webPipe = webPipe;
                _messageBuffer = new(new DataflowBlockOptions
                {
                    BoundedCapacity = 32
                });
            }
            public async Task<byte[]> PollOrNull(int timeoutMillis)
            {
                /*if (_messageBuffer.TryReceiveAll(out var msgs))
                {
                    return MiscHelpers.Combine(msgs);
                }*/
                try
                {
                    return await _messageBuffer.ReceiveAsync(
                        new CancellationTokenSource(timeoutMillis).Token
                    );
                }
                catch (OperationCanceledException)
                {
                    return null;
                }
            }
            public async Task Broadcast(byte[] data)
            {
                _webPipe.MessageCount++;
                foreach (var p in _webPipe._participants.Values)
                {
                    if (p != this)
                        if (!await p._messageBuffer.SendAsync(data, CancellationToken.None))
                            throw new Exception("BUG");
                }
            }

            public bool Close()
            {
                bool result = _webPipe._participants.TryRemove(this, out _);
                if (_webPipe.ParticipantCount == 0)
                    _webPipe._service.TryFree(_webPipe);
                return result;
            }
        }
        private WebPipeService _service;
        public WebPipe(WebPipeService service) => _service = service;
        private ConcurrentDictionary<Participant, Participant> _participants = new();
        public readonly Guid pid = Guid.NewGuid();
        public WebPipeCapabilities capabilities = WebPipeCapabilities.None;
        public string name = "(Anonymous)";
        public int MessageCount { get; private set; }
        public Participant NewConnection()
        {
            var p = new Participant(this);
            if (!_participants.TryAdd(p, p))
                throw new Exception("IMPOSSIBLE");
            return p;
        }

        public int ParticipantCount => _participants.Count;
    }
}
