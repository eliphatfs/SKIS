using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace SKIS.Central.WebPipe
{
    public class WebPipe
    {
        public class Participant
        {
            private WebPipe _webPipe;
            private Channel<byte[]> _messageBuffer;
            public Participant(WebPipe webPipe)
            {
                _webPipe = webPipe;
                _messageBuffer = Channel.CreateBounded<byte[]>(32);
            }
            public async Task<byte[]> PollOrNull(int timeoutMillis)
            {
                return await _messageBuffer.Reader.ReadAsync(
                    new CancellationTokenSource(timeoutMillis).Token
                );
            }
            public async Task Broadcast(byte[] data)
            {
                foreach (var p in _webPipe._participants.Values)
                {
                    if (p != this)
                        await p._messageBuffer.Writer.WriteAsync(data, CancellationToken.None);
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
        public Participant NewConnection()
        {
            var p = new Participant(this);
            _participants.TryAdd(p, p);
            return p;
        }

        public int ParticipantCount => _participants.Count;
    }
}
