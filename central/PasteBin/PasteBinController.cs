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

namespace SKIS.Central.PasteBin
{
    [ApiController]
    public class PasteBinController
    {
        private readonly ILogger<PasteBinController> _logger;
        private readonly PasteBinService _pasteBinService;
        public PasteBinController(ILogger<PasteBinController> logger, PasteBinService pasteBinService)
        {
            _logger = logger;
            _pasteBinService = pasteBinService;
        }
    }
}
