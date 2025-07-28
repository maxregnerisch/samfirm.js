# SamFirm.js

A streaming downloader, decryptor and extractor of Samsung firmware.

## Getting started

### Pre-Requisites

1. Install [NodeJS](https://nodejs.org/) version `Current`.

### Run

`sudo npm i -g samfirm` and then `samfirm`.

Or `npx samfirm`.

Or build from source.

### Build

1. `git clone https://github.com/jesec/samfirm.js.git`
1. `npm install`
1. `npm run build`

### Development / Running from Source

For development or running the latest version with model transformations:

```bash
# Install dependencies
npm install

# Build and run (recommended)
NODE_OPTIONS="--openssl-legacy-provider" npm run build
node dist/index.js -m SM-S906B -r EUX

# Or use the provided script
./run.sh -m SM-S906B -r EUX

# Or for development with auto-reload
npm start -- -m SM-S906B -r EUX
```

### Model Transformation Feature

This version includes deep recoding functionality that automatically transforms certain Samsung model identifiers:

- `s906b` → `s916b`
- `S906B` → `S916B` 
- `SM-S906B` → `SM-S916B`
- `sm-s906b` → `sm-s916b`

When transformation occurs, you'll see:
```
🔄 Model transformation applied: SM-S906B → SM-S916B
Model: SM-S906B (processing as SM-S916B)
```

## Example

```
> samfirm -m SM-F916N -r KOO

  Model: SM-F916N
  Region: KOO

  Latest version:
    PDA: F916NTBU1ATJC
    CSC: F916NOKT1ATJC
    MODEM: F916NKSU1ATJ7

  OS: Q(Android 10)
  Filename: SM-F916N_10_20201028094404_saezf08xjk_fac.zip.enc4
  Size: 5669940496 bytes
  Logic Value: 611oq0u820f7uv34
  Description:
    • SIM Tray 제거시 가이드 팝업 적용
    • 충전 동작 관련 안정화 코드 적용
    • 단말 동작 관련 안정화 코드 적용
    • 단말 보안 관련 안정화 코드 적용

    https://doc.samsungmobile.com/SM-F916N/KOO/doc.html

/home/jc/samfirmjs/SM-F916N_KOO/
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0% | 41774309/5669940496 | BL_F916NTBU1ATJC_C...
```

## License

```
Copyright (C) 2020 Jesse Chan <jc@linux.com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```
