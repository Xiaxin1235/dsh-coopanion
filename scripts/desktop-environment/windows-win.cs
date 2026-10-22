using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class DesktopWindowProbe {
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
    delegate bool EnumProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] static extern IntPtr GetTopWindow(IntPtr window);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("dwmapi.dll", EntryPoint="DwmGetWindowAttribute")] static extern int GetFrame(IntPtr window, int attr, out RECT rect, int size);
    [DllImport("dwmapi.dll", EntryPoint="DwmGetWindowAttribute")] static extern int GetCloaked(IntPtr window, int attr, out int value, int size);
    public sealed class Bounds { public int x, y, width, height; }
    public sealed class Window { public string id; public int pid; public Bounds bounds; }
    public sealed class Snapshot { public string status, units = "physical-pixels"; public List<Window> windows = new List<Window>(); }
    public static Snapshot Read(int targetPid) {
        if (targetPid <= 0) throw new ArgumentException("Invalid pid");
        var result = new Snapshot { status = "available" };
        var found = new Dictionary<IntPtr, Window>();
        bool ok = EnumWindows(delegate(IntPtr handle, IntPtr unused) {
            uint pid; GetWindowThreadProcessId(handle, out pid);
            if (pid != (uint)targetPid || !IsWindowVisible(handle) || IsIconic(handle)) return true;
            int cloaked; RECT rect;
            if (GetCloaked(handle, 14, out cloaked, 4) != 0) { result.status = "partial"; return true; }
            if (cloaked != 0) return true;
            // DWM visible frame is in physical pixels, independent of DPI virtualization.
            if (GetFrame(handle, 9, out rect, Marshal.SizeOf(typeof(RECT))) != 0) { result.status = "partial"; return true; }
            if (found.Count >= 64) { result.status = "partial"; return false; }
            found[handle] = new Window { id = handle.ToInt64().ToString(), pid = targetPid,
                bounds = new Bounds { x = rect.Left, y = rect.Top, width = rect.Right - rect.Left, height = rect.Bottom - rect.Top } };
            return true;
        }, IntPtr.Zero);
        if (!ok) result.status = "partial";
        // Explicit bounded Z walk; do not infer stacking from EnumWindows callback order.
        var visited = new HashSet<IntPtr>();
        var cursor = GetTopWindow(IntPtr.Zero);
        while (cursor != IntPtr.Zero && visited.Count < 4096 && visited.Add(cursor)) {
            Window window;
            if (found.TryGetValue(cursor, out window)) { result.windows.Add(window); found.Remove(cursor); }
            cursor = GetWindow(cursor, 2); // GW_HWNDNEXT
        }
        if (cursor != IntPtr.Zero || found.Count != 0) result.status = "partial";
        return result;
    }
}
