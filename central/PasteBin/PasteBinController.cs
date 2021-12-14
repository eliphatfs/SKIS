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

namespace SKIS.Central.PasteBin
{
    [ApiController]
    public class PasteBinController : ControllerBase
    {
        private readonly ILogger<PasteBinController> _logger;
        private readonly PasteBinService _pasteBinService;
        public PasteBinController(ILogger<PasteBinController> logger, PasteBinService pasteBinService)
        {
            _logger = logger;
            _pasteBinService = pasteBinService;
        }
        [HttpGet("/pastebin/{key}")]
        public PasteBin Fetch(string key)
        {
            if (_pasteBinService.PasteBins.TryGetValue(key.ToLowerInvariant(), out var pasteBin))
                return pasteBin;
            else
                throw new HttpException(HttpStatusCode.BadRequest, "Paste bin key does not exist");
        }
        [HttpPost("/pastebin")]
        public object Paste([FromForm] string name, [FromForm] string contents)
        {
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrEmpty(contents))
                throw new HttpException(HttpStatusCode.BadRequest, "Name or contents empty or not found");
            return new { key = _pasteBinService.Paste(name, contents).Item1 };
        }
    }
}
