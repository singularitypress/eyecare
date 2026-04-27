# eyecare

A lightweight, cross-platform eye care and break reminder application. Built to run seamlessly on both Windows and macOS, featuring a deeply integrated native feel with modern window transparency effects.

## Features

- **Smart Break Timers:** Tracks your active screen time and reminds you when it is time to look away and rest your eyes.
- **Native OS Transparency:**
  - **Windows:** Utilizes `window-vibrancy` to apply native Acrylic blur effects to the application background.
  - **macOS:** Designed to support Apple's native Vibrancy (HUD Window) APIs for a seamless integration with the desktop environment.
- **Custom Client-Side Decorations:** Completely frameless window design featuring a custom React-built title bar with integrated minimize, maximize, and close controls.
- **Cross-Platform:** Built from the ground up to support both Windows (`.exe`) and macOS (`.app` / `.dmg`) natively.

## Stack

- **Framework:** [Tauri 2.0](https://v2.tauri.app/)
- **Frontend:** TypeScript, React, Vite
- **Styling:** CSS / Tailwind CSS (Custom Titlebar)
- **Backend / Systems:** Rust
- **Package Manager:** [Bun](https://bun.sh/)

## Prerequisites

Before you begin, ensure you have the following installed on your system:
- [Bun](https://bun.sh/) (JavaScript runtime and package manager)
- [Rust](https://www.rust-lang.org/tools/install)
- [Visual Studio with C++ build tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (For Windows)
- Xcode Command Line Tools (For macOS)

## Setup & Installation

Clone the repository and install the frontend dependencies:

```bash
git clone [https://github.com/singularitypress/eyecare.git](https://github.com/singularitypress/eyecare.git)
cd eyecare
bun i
```

## Development

To run the application in development mode with hot-module replacement (HMR) and Rust debugging enabled:

```bash
bun run tauri dev
```

*Note for macOS development: To render the transparent window correctly, ensure `macOSPrivateApi: true` is set in your `tauri.conf.json`.*

## Building for Production

To compile a highly optimized, production-ready binary for your current operating system:

```bash
bun run tauri build
```

The resulting executables will be located in `src-tauri/target/release/`. 

*If distributing the macOS `.dmg` to other users without signing via an Apple Developer account, users may need to clear the Apple Gatekeeper quarantine flag using `xattr -cr /Applications/eyecare.app`.*

## License

This project is licensed under the [MIT License](LICENSE).