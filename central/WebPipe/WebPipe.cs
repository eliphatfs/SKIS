using System.Collections.Concurrent;

namespace SKIS.Central.WebPipe
{
    public class WebPipe
    {
        public class Participant
        {
            private WebPipe _webPipe;
            private BlockingCollection<byte[]> _messageBuffer;
            public Participant(WebPipe webPipe)
            {
                _webPipe = webPipe;
                _messageBuffer = new(new ConcurrentQueue<byte[]>(), 32);
            }
            public byte[] PollOrNull(int timeoutMillis)
            {
                if (_messageBuffer.TryTake(out var item, timeoutMillis))
                    return item;
                else
                    return null;
            }
            public void Broadcast()
            {
                
            }
        }
        private ConcurrentBag<Participant> _participants = new();
        public Participant NewConnection()
        {
            var p = new Participant(this);
            _participants.Add(p);
            return p;
        }
    }
}
