using System;

namespace SKIS.Central.WebPipe
{
    public class WebPipeAllocationResult
    {
        public bool success { get; set; }
        public string error { get; set; }
        public Guid pid { get; set; }
    }
}
