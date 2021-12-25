using System;

namespace SKIS.Central.WebPipe
{
    public class WebPipeQueryResult
    {
        public WebPipeCapabilities capabilities { get; set; }
        public Guid key { get; set; }
        public Guid pid { get; set; }
        public int numParticipants { get; set; }
        public int numMessages { get; set; }
        public string name { get; set; }
    }
}
