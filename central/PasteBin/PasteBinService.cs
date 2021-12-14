using System;
using System.Net;
using System.Collections.Generic;
using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using SKIS.Central.ASPNetAddons;

namespace SKIS.Central.PasteBin
{
    public class PasteBinService
    {
        private ILogger<PasteBinService> _logger;
        public PasteBinService(ILogger<PasteBinService> logger)
        {
            _logger = logger;
        }
        public IReadOnlyDictionary<string, PasteBin> PasteBins => pasteBins;
        protected ConcurrentDictionary<string, PasteBin> pasteBins = new();
        protected ConcurrentQueue<string> outpopQueue = new();

        public const int MAX_CONTENT_SIZE = 100000;
        public const int MAX_PASTEBINS = 100;

        public (string, PasteBin) Paste(string name, string contents)
        {
            if (contents.Length > MAX_CONTENT_SIZE)
                throw new HttpException(HttpStatusCode.RequestEntityTooLarge);
            var bin = new PasteBin { name = name, contents = contents };
            while (outpopQueue.Count >= MAX_PASTEBINS)
            {
                if (outpopQueue.TryDequeue(out var result))
                    if (!pasteBins.TryRemove(result, out _))
                        throw new Exception("BUG: Pastebin not found when deque");
            }
            for (long i = 1; ; i++)
            {
                string key = name + "-" + i;
                if (pasteBins.TryAdd(key, bin))
                {
                    outpopQueue.Enqueue(key);
                    _logger.LogInformation("Created paste bin {key}.", key);
                    return (key, bin);
                }
            }
        }
    }
}