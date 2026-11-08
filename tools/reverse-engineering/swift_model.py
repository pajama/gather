#!/usr/bin/env python3
"""
Recovers a Swift app's type model from its compiled Mach-O binary, on any OS.

Swift keeps reflection metadata in the binary even in stripped release
builds: nominal type descriptors (__swift5_types -> __TEXT,__const) with each
type's name, kind and parent, and field descriptors (__swift5_fieldmd) whose
records point at field names (__swift5_reflstr) and mangled field types.
This script reads those sections directly, so it needs no macOS tools, no
disassembler and no symbols.

    python3 swift_model.py App.app/Contents/MacOS/App            # all types
    python3 swift_model.py App --module App --json model.json    # one module, as JSON

Universal (fat) binaries are read for their arm64 slice.
"""
import argparse
import json
import re
import struct
import sys

KIND = {0: 'module', 1: 'extension', 2: 'anonymous', 3: 'protocol', 4: 'opaque', 16: 'class', 17: 'struct', 18: 'enum'}

STD = {
    'Si': 'Int', 'Su': 'UInt', 'SS': 'String', 'Sb': 'Bool', 'Sd': 'Double', 'Sf': 'Float', 'Sh': 'Set',
    's5Int32V': 'Int32', 's5Int64V': 'Int64', 's5UInt8V': 'UInt8', 'ypXp': 'Any.Type', 'yp': 'Any', 'yXl': 'AnyObject',
    '10Foundation4DateV': 'Date', '10Foundation3URLV': 'URL', '10Foundation4UUIDV': 'UUID', '10Foundation4DataV': 'Data',
    '10Foundation7DecimalV': 'Decimal', '12CoreGraphics7CGFloatV': 'CGFloat', 'So7CGFloata': 'CGFloat',
}


class MachO:
    def __init__(self, path):
        data = open(path, 'rb').read()
        magic = struct.unpack_from('>I', data, 0)[0]
        if magic in (0xCAFEBABE, 0xCAFEBABF):  # fat: pick arm64 (cputype 0x0100000C)
            n = struct.unpack_from('>I', data, 4)[0]
            wide = magic == 0xCAFEBABF
            for i in range(n):
                if wide:
                    cpu, _sub, off, size = struct.unpack_from('>IIQQ', data, 8 + i * 32)[:4]
                else:
                    cpu, _sub, off, size = struct.unpack_from('>IIII', data, 8 + i * 20)[:4]
                if cpu == 0x0100000C:
                    data = data[off:off + size]
                    break
            else:
                raise SystemExit('no arm64 slice')
        if struct.unpack_from('<I', data, 0)[0] != 0xFEEDFACF:
            raise SystemExit('not a 64-bit Mach-O')
        self.data = data
        self.sections = {}
        self.segments = []
        self.imports = []
        self.pointer_formats = {}  # segment index -> DYLD_CHAINED_PTR_* format
        ncmds = struct.unpack_from('<I', data, 16)[0]
        off = 32
        for _ in range(ncmds):
            cmd, size = struct.unpack_from('<II', data, off)
            if cmd == 0x80000034:  # LC_DYLD_CHAINED_FIXUPS: import names and each segment's pointer format
                dataoff = struct.unpack_from('<I', data, off + 8)[0]
                _ver, starts_off, imp_off, sym_off, count, fmt = struct.unpack_from('<IIIIII', data, dataoff)
                seg_count = struct.unpack_from('<I', data, dataoff + starts_off)[0]
                for seg in range(seg_count):
                    info_off = struct.unpack_from('<I', data, dataoff + starts_off + 4 + 4 * seg)[0]
                    if info_off:
                        # dyld_chained_starts_in_segment: size u32, page_size u16, pointer_format u16, ...
                        self.pointer_formats[seg] = struct.unpack_from('<H', data, dataoff + starts_off + info_off + 6)[0]
                for k in range(count):
                    if fmt == 1:
                        raw = struct.unpack_from('<I', data, dataoff + imp_off + 4 * k)[0]
                        name_off = raw >> 9
                    elif fmt == 2:
                        raw = struct.unpack_from('<I', data, dataoff + imp_off + 8 * k)[0]
                        name_off = raw >> 9
                    else:
                        raw = struct.unpack_from('<Q', data, dataoff + imp_off + 16 * k)[0]
                        name_off = raw >> 32
                    start = dataoff + sym_off + name_off
                    self.imports.append(data[start:data.find(b'\0', start)].decode('utf-8', 'replace'))
            if cmd == 0x19:  # LC_SEGMENT_64
                segname = data[off + 8:off + 24].rstrip(b'\0').decode()
                vmaddr, vmsize, fileoff, filesize = struct.unpack_from('<QQQQ', data, off + 24)
                nsects = struct.unpack_from('<I', data, off + 64)[0]
                self.segments.append((vmaddr, vmsize, fileoff, filesize))
                for s in range(nsects):
                    so = off + 72 + s * 80
                    sect = data[so:so + 16].rstrip(b'\0').decode()
                    addr, ssize = struct.unpack_from('<QQ', data, so + 32)
                    soff = struct.unpack_from('<I', data, so + 48)[0]
                    self.sections[(segname, sect)] = (addr, ssize, soff)
            off += size

    def segment_index(self, vm):
        for idx, (vmaddr, vmsize, _fileoff, _filesize) in enumerate(self.segments):
            if vmaddr <= vm < vmaddr + vmsize:
                return idx
        return None

    def offset(self, vm, size=1):
        """File offset of `size` bytes at address `vm`, or None when they aren't backed by the file."""
        for vmaddr, vmsize, fileoff, filesize in self.segments:
            # Segments with no file contents (__PAGEZERO, zero-fill) map nothing.
            if filesize and vmaddr <= vm and vm + size <= vmaddr + min(vmsize, filesize):
                o = fileoff + (vm - vmaddr)
                return o if o + size <= len(self.data) else None
        return None

    def _read(self, fmt, vm):
        o = self.offset(vm, struct.calcsize(fmt))
        return None if o is None else struct.unpack_from(fmt, self.data, o)[0]

    def i32(self, vm):
        return self._read('<i', vm)

    def u32(self, vm):
        return self._read('<I', vm)

    def u16(self, vm):
        return self._read('<H', vm)

    def rel(self, vm):
        v = self.i32(vm)
        return None if not v else vm + v

    def cstring(self, vm, limit=512):
        o = self.offset(vm)
        if o is None:
            return None
        end = self.data.find(b'\0', o, o + limit)
        return self.data[o:end].decode('utf-8', 'replace') if end >= 0 else None

    def pointer(self, vm):
        """
        Follows a pointer slot: ('import', symbol) for a bound import, ('local', vm) for a rebase.
        Decodes the chained-fixup format of the slot's segment (arm64e authenticated pointers included).
        """
        v = self._read('<Q', vm)
        if v is None:
            return None
        seg = self.segment_index(vm)
        fmt = self.pointer_formats.get(seg, 2)
        base = self.segments[1][0] if len(self.segments) > 1 and self.segments[0][0] == 0 else 0
        if fmt in (1, 9, 12):  # DYLD_CHAINED_PTR_ARM64E, _USERLAND, _USERLAND24
            auth, bind = v >> 63, (v >> 62) & 1
            if bind:
                ordinal = v & (0xFFFFFF if fmt == 12 else 0xFFFF)
                return ('import', self.imports[ordinal]) if ordinal < len(self.imports) else None
            if auth:
                return ('local', base + (v & 0xFFFFFFFF))
            target = v & 0x7FFFFFFFFFF
            return ('local', target if fmt == 1 else base + target)
        if fmt in (2, 6):  # DYLD_CHAINED_PTR_64 (vmaddr), DYLD_CHAINED_PTR_64_OFFSET (offset from base)
            if v >> 63:
                ordinal = v & 0xFFFFFF
                return ('import', self.imports[ordinal]) if ordinal < len(self.imports) else None
            target = v & 0xFFFFFFFFF
            return ('local', base + target if fmt == 6 or target < base else target)
        return None  # 32-bit and kernel-cache formats are not used by iOS/macOS apps

    def section(self, seg, name):
        for (s, n), v in self.sections.items():
            if n == name and (seg is None or s == seg):
                return v
        return None


class Model:
    def __init__(self, macho):
        self.m = macho
        self.names = {}

    def context(self, vm):
        """(kind, name, parent_vm) of a context descriptor."""
        flags = self.m.u32(vm)
        if flags is None:
            return None
        kind = flags & 0x1F
        parent_raw = self.m.i32(vm + 4)
        parent = None
        if parent_raw:
            target = vm + 4 + (parent_raw & ~1)
            if parent_raw & 1:  # indirect: pointer to descriptor (another image) - not followed
                parent = None
            else:
                parent = target
        name = None
        if kind in (0, 16, 17, 18, 3):
            name_ptr = self.m.rel(vm + 8)
            name = self.m.cstring(name_ptr) if name_ptr else None
        return kind, name, parent

    def qualified(self, vm, depth=0):
        if vm in self.names:
            return self.names[vm]
        info = self.context(vm)
        if not info or depth > 12:
            return None, None
        kind, name, parent = info
        module, path = None, []
        cursor = parent
        while cursor:
            pk = self.context(cursor)
            if not pk:
                break
            if pk[0] == 0:
                module = pk[1]
                break
            if pk[0] in (16, 17, 18):
                module, ppath = self.qualified(cursor, depth + 1)
                path = ppath.split('.') if ppath else []
                break
            if pk[0] == 1:  # extension: nest under the extended type ("extension Recipe { enum CodingKeys }")
                extended = self.extended_type(cursor, depth)
                if extended:
                    module = module or extended[0]
                    path = extended[1].split('.') if extended[1] else []
                    # The extension's own parent is the module that declares it.
                    owner = self.context(pk[2]) if pk[2] else None
                    if owner and owner[0] == 0:
                        module = owner[1]
                    break
            cursor = pk[2]  # anonymous (file-private) context: keep walking up
        full = '.'.join([*path, name or '?'])
        self.names[vm] = (module, full)
        return module, full

    def extended_type(self, ext_vm, depth=0):
        """(module, qualified name) of the type an extension context extends, or None."""
        name_ptr = self.m.rel(ext_vm + 8)
        o = self.m.offset(name_ptr, 5) if name_ptr else None
        if o is None:
            return None
        kind = self.m.data[o]
        if kind in (1, 2):
            rel = struct.unpack_from('<i', self.m.data, o + 1)[0]
            target = name_ptr + 1 + rel
            if kind == 1:
                return self.qualified(target, depth + 1)
            slot = self.m.pointer(target)
            if slot and slot[0] == 'local':
                return self.qualified(slot[1], depth + 1)
            if slot and slot[0] == 'import':
                return None, imported_type(slot[1])
            return None
        return None, demangle_type(self.m.cstring(name_ptr) or '')

    def type_name(self, vm):
        """Readable Swift type from a mangled type name with symbolic references."""
        if vm is None:
            return '?'
        o = self.m.offset(vm)
        if o is None:
            return '?'
        raw = self.m.data
        out, i = [], o
        while i < len(raw) and raw[i] != 0 and i - o < 256:
            b = raw[i]
            if b in (1, 2):  # symbolic reference: 1 direct, 2 indirect
                rel = struct.unpack_from('<i', raw, i + 1)[0]
                target = vm + (i - o) + 1 + rel
                if b == 1:
                    _mod, nm = self.qualified(target)
                    out.append(f'«{nm}»')
                else:
                    slot = self.m.pointer(target)
                    if slot and slot[0] == 'import':
                        out.append(f'«{imported_type(slot[1])}»')
                    elif slot and slot[0] == 'local':
                        _mod, nm = self.qualified(slot[1])
                        out.append(f'«{nm}»')
                    else:
                        out.append('«external»')
                i += 5
            elif 0x01 <= b <= 0x17:  # other relative symbolic references: 1 byte + 4-byte offset
                i += 5
                out.append('«ref»')
            elif 0x18 <= b <= 0x1F:  # absolute symbolic references: 1 byte + a pointer
                i += 9
                out.append('«ref»')
            else:
                out.append(chr(b))
                i += 1
        return demangle_type(''.join(out))


def imported_type(symbol):
    """'_$s10Foundation4DateVMn' (a nominal type descriptor symbol) -> 'Date'."""
    import re
    s = symbol.lstrip('_')
    if not s.startswith('$s'):
        return symbol
    rest = s[2:]
    if rest.startswith('So'):
        rest = rest[2:]
    else:
        n = re.match(r'\d+', rest)
        if not n:
            return symbol
        rest = rest[len(n.group(0)) + int(n.group(0)):]  # skip the module name
    parts = []
    while True:
        n = re.match(r'\d+', rest)
        if not n:
            break
        length = int(n.group(0))
        parts.append(rest[len(n.group(0)):len(n.group(0)) + length])
        rest = rest[len(n.group(0)) + length:]
        if rest[:1] in ('V', 'C', 'O', 'P', 'a'):
            rest = rest[1:]
        else:
            break
    return '.'.join(parts) if parts else symbol


def _identifier(m, i):
    """A length-prefixed identifier at `i` ('4Date') -> ('Date', next index), or None."""
    n = re.match(r'\d+', m[i:])
    if not n:
        return None
    start = i + len(n.group(0))
    end = start + int(n.group(0))
    return (m[start:end], end) if end <= len(m) else None


def _nominal(m, i):
    """
    A nominal type at `i`: a module then one or more names, each followed by its kind
    ('10Foundation4DateV', '7MyApp5OuterV5InnerO'), or an Objective-C import ('So8NSStringC').
    Returns (dotted name without the module, next index), or None.
    """
    objc = m.startswith('So', i)
    if objc:
        i += 2
    else:
        module = _identifier(m, i)
        if not module:
            return None
        i = module[1]
    names = []
    while True:
        ident = _identifier(m, i)
        if not ident or ident[1] >= len(m) or m[ident[1]] not in 'VCOa':
            break
        names.append(ident[0])
        i = ident[1] + 1
    return ('.'.join(names), i) if names else None


def parse_type(m, i=0):
    """
    Reads one type from a field-type mangling at `i`; returns (readable, next index).
    Recursive so generic arguments nest: 'SDySSSiSgG' is [String: Int?].
    """
    if m.startswith('«', i):
        j = m.index('»', i)
        text, i = m[i + 1:j], j + 1
    elif m.startswith(('Say', 'Shy'), i):
        array = m.startswith('Say', i)
        inner, i = parse_type(m, i + 3)
        if not m.startswith('G', i):
            raise ValueError(m)
        text, i = (f'[{inner}]' if array else f'Set<{inner}>'), i + 1
    elif m.startswith('SDy', i):
        key, i = parse_type(m, i + 3)
        value, i = parse_type(m, i)
        if not m.startswith('G', i):
            raise ValueError(m)
        text, i = f'[{key}: {value}]', i + 1
    else:
        for key in sorted(STD, key=len, reverse=True):
            if m.startswith(key, i):
                text, i = STD[key], i + len(key)
                break
        else:
            nominal = _nominal(m, i)
            if not nominal:
                raise ValueError(m)
            text, i = nominal
    while m.startswith('Sg', i):
        text, i = text + '?', i + 2
    return text, i


def demangle_type(m):
    """Readable rendering of a field-type mangling; the raw mangling (optionals marked) when not understood."""
    if not m:
        return '?'
    try:
        text, end = parse_type(m)
        if end == len(m):
            return text
    except (ValueError, IndexError):
        pass
    opt = 0
    while m.endswith('Sg') and len(m) > 2:
        m, opt = m[:-2], opt + 1
    return m + '?' * opt


def build(path, module=None):
    m = MachO(path)
    model = Model(m)
    types_sec = m.section('__TEXT', '__swift5_types')
    if not types_sec:
        raise SystemExit('no __swift5_types section: not a Swift binary, or no type metadata')
    addr, size, _ = types_sec
    types = []
    for k in range(size // 4):
        rec = addr + k * 4
        raw = m.i32(rec)
        if raw is None:
            continue
        target = rec + (raw & ~3)
        if raw & 3:  # indirect record
            continue
        info = model.context(target)
        if not info:
            continue
        kind, name, _parent = info
        mod, full = model.qualified(target)
        if module and mod != module:
            continue
        fields = []
        fd = m.rel(target + 16)
        if fd:
            rec_size = m.u16(fd + 10) or 12
            count = m.u32(fd + 12) or 0
            for f in range(min(count, 512)):
                fr = fd + 16 + f * rec_size
                flags = m.u32(fr)
                tname = m.rel(fr + 4)
                fname_ptr = m.rel(fr + 8)
                fname = m.cstring(fname_ptr) if fname_ptr else None
                entry = {'name': fname, 'type': model.type_name(tname) if tname else None}
                if flags and flags & 2:
                    entry['var'] = True
                fields.append(entry)
        types.append({'module': mod, 'name': full, 'kind': KIND.get(kind, kind), 'fields': fields})
    protos = m.section('__TEXT', '__swift5_protos')
    if protos:
        paddr, psize, _ = protos
        for k in range(psize // 4):
            rec = paddr + k * 4
            raw = m.i32(rec)
            if not raw or raw & 1:
                continue
            target = rec + (raw & ~3)
            info = model.context(target)
            if not info or info[0] != 3:
                continue
            mod, full = model.qualified(target)
            if module and mod != module:
                continue
            types.append({'module': mod, 'name': full, 'kind': 'protocol', 'fields': []})
    return types


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('binary')
    ap.add_argument('--module')
    ap.add_argument('--json')
    ap.add_argument('--type', help='print one type (substring match)')
    args = ap.parse_args()
    types = build(args.binary, args.module)
    if args.json:
        json.dump(types, open(args.json, 'w'), indent=1)
    shown = [t for t in types if not args.type or args.type in t['name']]
    for t in shown[: (50 if not args.type else 1000)]:
        fields = ', '.join(f"{f['name']}: {f['type']}" if f['type'] else f"{f['name']}" for f in t['fields'])
        print(f"{t['kind']} {t['module']}.{t['name']} {{ {fields} }}")
    kinds = {}
    for t in types:
        kinds[t['kind']] = kinds.get(t['kind'], 0) + 1
    print(f'{len(types)} types {kinds}', file=sys.stderr)


if __name__ == '__main__':
    main()
