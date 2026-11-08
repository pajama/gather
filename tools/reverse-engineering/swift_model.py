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
        ncmds = struct.unpack_from('<I', data, 16)[0]
        off = 32
        for _ in range(ncmds):
            cmd, size = struct.unpack_from('<II', data, off)
            if cmd == 0x80000034:  # LC_DYLD_CHAINED_FIXUPS: read the import names for bound pointers
                dataoff = struct.unpack_from('<I', data, off + 8)[0]
                _ver, _starts, imp_off, sym_off, count, fmt = struct.unpack_from('<IIIIII', data, dataoff)
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

    def offset(self, vm):
        for vmaddr, vmsize, fileoff, filesize in self.segments:
            if vmaddr <= vm < vmaddr + min(vmsize, filesize or vmsize):
                return fileoff + (vm - vmaddr)
        return None

    def i32(self, vm):
        o = self.offset(vm)
        return None if o is None else struct.unpack_from('<i', self.data, o)[0]

    def u32(self, vm):
        o = self.offset(vm)
        return None if o is None else struct.unpack_from('<I', self.data, o)[0]

    def u16(self, vm):
        o = self.offset(vm)
        return None if o is None else struct.unpack_from('<H', self.data, o)[0]

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
        """Follows a pointer slot: ('import', symbol) for a bound import, ('local', vm) for a rebase."""
        o = self.offset(vm)
        if o is None:
            return None
        v = struct.unpack_from('<Q', self.data, o)[0]
        if v >> 63:  # DYLD_CHAINED_PTR_64(_OFFSET) bind
            ordinal = v & 0xFFFFFF
            return ('import', self.imports[ordinal]) if ordinal < len(self.imports) else None
        target = v & 0xFFFFFFFFF
        base = self.segments[1][0] if len(self.segments) > 1 and self.segments[0][0] == 0 else 0
        return ('local', target if target >= base else base + target)

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
            cursor = pk[2]  # anonymous (file-private) or extension context: keep walking up
        full = '.'.join([*path, name or '?'])
        self.names[vm] = (module, full)
        return module, full

    def type_name(self, vm):
        """Readable Swift type from a mangled type name with symbolic references."""
        if vm is None:
            return '?'
        o = self.m.offset(vm)
        if o is None:
            return '?'
        raw = self.m.data
        out, i = [], o
        while raw[i] != 0 and i - o < 256:
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
            elif 0x01 <= b <= 0x17:
                i += 5 if b <= 0x0B else 9
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


def demangle_type(m):
    """Small readable rendering of common field-type manglings."""
    opt = 0
    while m.endswith('Sg'):
        m = m[:-2]
        opt += 1
    if m.startswith('Say') and m.endswith('G'):
        base = f'[{demangle_type(m[3:-1])}]'
    elif m.startswith('SDy') and m.endswith('G'):
        inner = m[3:-1]
        for split in range(1, len(inner)):
            k, v = demangle_type(inner[:split]), demangle_type(inner[split:])
            if '?' not in k and '?' not in v and not k.startswith('mangled') and not v.startswith('mangled'):
                base = f'[{k}: {v}]'
                break
        else:
            base = f'[{inner}]'
    elif m.startswith('Shy') and m.endswith('G'):
        base = f'Set<{demangle_type(m[3:-1])}>'
    elif m in STD:
        base = STD[m]
    elif m.startswith('«') and m.endswith('»') and m.count('«') == 1:
        base = m[1:-1]
    else:
        base = m if m else '?'
    return base + '?' * opt


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
