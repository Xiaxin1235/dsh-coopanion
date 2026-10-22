"""D0: read EWMH geometry of test-owned windows, without titles or input."""
import ctypes as C
import ctypes.util
import json
import sys


def read_windows(pid):
    x = C.CDLL(ctypes.util.find_library('X11') or 'libX11.so.6')
    ptr, word, integer = C.c_void_p, C.c_ulong, C.c_int
    def bind(name, result, *args):
        f = getattr(x, name)
        f.restype, f.argtypes = result, args
        return f
    open_display = bind('XOpenDisplay', ptr, C.c_char_p)
    close_display = bind('XCloseDisplay', integer, ptr)
    root_window = bind('XDefaultRootWindow', word, ptr)
    intern = bind('XInternAtom', word, ptr, C.c_char_p, integer)
    prop = bind('XGetWindowProperty', integer, ptr, word, word, C.c_long, C.c_long, integer, word,
                C.POINTER(word), C.POINTER(integer), C.POINTER(word), C.POINTER(word), C.POINTER(ptr))
    free = bind('XFree', integer, ptr)
    translate = bind('XTranslateCoordinates', integer, ptr, word, word, integer, integer,
                     C.POINTER(integer), C.POINTER(integer), C.POINTER(word))

    class Attributes(C.Structure):
        _fields_ = [(n, integer) for n in ('x', 'y', 'width', 'height', 'border_width', 'depth')] + [
            ('visual', ptr), ('root', word), ('class_', integer), ('bit_gravity', integer),
            ('win_gravity', integer), ('backing_store', integer), ('backing_planes', word),
            ('backing_pixel', word), ('save_under', integer), ('colormap', word),
            ('map_installed', integer), ('map_state', integer), ('all_event_masks', C.c_long),
            ('your_event_mask', C.c_long), ('do_not_propagate_mask', C.c_long),
            ('override_redirect', integer), ('screen', ptr)]

    attributes = bind('XGetWindowAttributes', integer, ptr, word, C.POINTER(Attributes))
    errors = []
    handler_type = C.CFUNCTYPE(integer, ptr, ptr)
    @handler_type
    def on_error(_display, _event):
        errors.append(True)
        return 0
    bind('XSetErrorHandler', ptr, handler_type)(on_error)
    display = open_display(None)
    if not display:
        return {'status': 'unavailable'}
    try:
        root = root_window(display)
        def atom(name):
            return intern(display, name.encode('ascii'), 1)
        def values(window, name):
            key = atom(name)
            if not key:
                return None
            kind, fmt, count, remaining, data = word(), integer(), word(), word(), ptr()
            code = prop(display, window, key, 0, 4096, 0, 0,
                        C.byref(kind), C.byref(fmt), C.byref(count), C.byref(remaining), C.byref(data))
            try:
                if code or not kind.value or fmt.value != 32 or remaining.value or count.value > 4096:
                    return None
                return list(C.cast(data, C.POINTER(word))[:count.value]) if count.value else []
            finally:
                if data:
                    free(data)
        supported = values(root, '_NET_SUPPORTED') or []
        if not all(atom(name) in supported for name in ('_NET_CLIENT_LIST_STACKING', '_NET_FRAME_EXTENTS')):
            return {'status': 'unsupported'}
        stack = values(root, '_NET_CLIENT_LIST_STACKING')
        if stack is None:
            return {'status': 'unavailable'}
        windows, partial = [], False
        for handle in reversed(stack):  # EWMH is bottom-to-top.
            owner = values(handle, '_NET_WM_PID')
            if owner != [pid]:
                continue
            a = Attributes()
            if not attributes(display, handle, C.byref(a)):
                partial = True
                continue
            if a.map_state != 2 or a.override_redirect:
                continue
            extents = values(handle, '_NET_FRAME_EXTENTS')
            px, py, child = integer(), integer(), word()
            if extents is None or len(extents) != 4 or not translate(display, handle, root, 0, 0, C.byref(px), C.byref(py), C.byref(child)):
                partial = True
                continue
            if len(windows) >= 64:
                partial = True
                break
            left, right, top, bottom = extents
            windows.append({'id': str(handle), 'pid': pid, 'bounds': {
                'x': px.value - left, 'y': py.value - top,
                'width': a.width + left + right, 'height': a.height + top + bottom}})
        return {'status': 'partial' if partial or errors else 'available', 'units': 'physical-pixels', 'windows': windows}
    finally:
        close_display(display)


if __name__ == '__main__':
    target = int(sys.argv[1])
    if target <= 0:
        raise ValueError('Invalid pid')
    print(json.dumps(read_windows(target)))
