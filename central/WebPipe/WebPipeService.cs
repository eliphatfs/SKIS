using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace SKIS.Central.WebPipe
{
    public class WebPipeService
    {
        private ILogger<WebPipeService> _logger;
        public WebPipeService(ILogger<WebPipeService> logger)
        {
            _logger = logger;
        }
        public IReadOnlyDictionary<Guid, WebPipe> WebPipes => webPipes;
        protected ConcurrentDictionary<Guid, WebPipe> webPipes = new();
        public WebPipe Allocate()
        {
            var pipe = new WebPipe(this);
            if (webPipes.TryAdd(pipe.pid, pipe))
            {
                _logger.LogInformation("Allocated web pipe {pid}.", pipe.pid);
                return pipe;
            }
            throw new Exception("Oops, you are lucky. UUID collision.");
        }

        public bool TryFree(WebPipe pipe)
        {
            if (webPipes.TryRemove(pipe.pid, out _))
            {
                _logger.LogInformation("Freed web pipe {pid}.", pipe.pid);
                return true;
            }
            else
            {
                _logger.LogInformation("Double free for web pipe {pid}, skipping.", pipe.pid);
                return false;
            }
        }
    }
}
