using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using System;
using System.Linq;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;

namespace SKIS.Central.ASPNetAddons
{
    public static class MiscHelpers
    {
        public static byte[] Combine(ICollection<byte[]> arrays)
        {
            byte[] ret = new byte[arrays.Sum(x => x.Length)];
            int offset = 0;
            foreach (byte[] data in arrays)
            {
                Buffer.BlockCopy(data, 0, ret, offset, data.Length);
                offset += data.Length;
            }
            return ret;
        }
        public static byte[] Combine(params byte[][] arrays)
            => Combine((ICollection<byte[]>)arrays);
    }
}