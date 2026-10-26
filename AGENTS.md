# Repository Guidelines

## Project Structure & Module Organization

This repository contains the C++ LiquidFun/Box2D physics engine and JavaScript bindings. Core code lives in `liquidfun/Box2D/Box2D/`, organized into `Common`, `Collision`, `Dynamics`, `Particle`, and `Rope`. Google Test suites and simulation baselines live in `liquidfun/Box2D/Unittests/`. Interactive examples are in `Testbed/` and `HelloWorld/`; JavaScript bindings and browser demos are in `lfjs/`. These paths are relative to `liquidfun/Box2D/`. Documentation and image assets live in its `Documentation/` directory, with Markdown build guides under `Box2D/Documentation/Building/`.

Treat root-level `googletest/`, `freeglut/`, and `liquidfun/Box2D/glui/` as bundled dependencies; keep changes there narrowly scoped.

## Build, Test, and Development Commands

Run these commands from the repository root with CMake and a C++ compiler installed:

- `cmake -S liquidfun/Box2D -B build -DBOX2D_BUILD_EXAMPLES=OFF` configures the library and unit tests without OpenGL examples.
- `cmake --build build --config Debug` builds the configured targets.
- `liquidfun\Box2D\Unittests\run_tests.bat -n` runs already-built Windows test executables.
- `bash liquidfun/Box2D/Unittests/run_tests.sh -n -C` runs already-built Unix tests without coverage collection.
- Enable `BOX2D_BUILD_EXAMPLES` to build and launch the `Testbed` target for interactive checks; this requires OpenGL.
- `make -C liquidfun/Box2D/lfjs` builds the JavaScript core using Emscripten.

The build files target legacy toolchains; consult the platform build guides if configuration fails.

## Coding Style & Naming Conventions

Match surrounding formatting: core C++ generally uses tabs and braces on separate lines; CMake uses two-space indentation. Preserve `b2` type/function prefixes, `m_` member names, and existing `.h`/`.cpp` pairs. Retain license headers. No repository-wide formatter or linter configuration is present; avoid unrelated formatting changes.

## Testing Guidelines

Add regression tests under `Unittests/<Area>/<Area>Tests.cpp`, using Google Test and descriptive `TEST`/`TEST_F` names. Register new suites with `test_executable(<Area>)` in `Unittests/CMakeLists.txt`. Run affected suites and the full suite before submitting physics changes. Review BodyTracker baseline differences before updating expected results. Coverage is optional via `BOX2D_CODE_COVERAGE` on Linux/macOS; no minimum percentage is specified.

## Commit & Pull Request Guidelines

Recent commits use short, imperative subjects such as `Fix corruption restoring particle groups`. Follow that style and keep commits focused. In pull requests, describe the behavior change, link relevant issues, and report build configuration and test results. Include screenshots or recordings for visible Testbed changes and explain intentional baseline updates.
