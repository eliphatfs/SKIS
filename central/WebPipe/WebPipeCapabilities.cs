using System;

namespace SKIS.Central.WebPipe
{
    [Flags]
    public enum WebPipeCapabilities
    {
        None = 0,
        ChatRoom = 1,
        XTerm = 2,
        Overflow = 4,
    }
}
