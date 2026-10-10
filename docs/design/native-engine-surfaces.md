# Native engine surfaces for a Studio Game Adapter (Unity and Unreal)

Date: 2026-10-10. Scope: how an external local app can reach a Unity or Unreal project's assets and running game.

## Method and confidence

Sources are official Unity (docs.unity3d.com, unity.com) and Epic (dev.epicgames.com, unrealengine.com) pages, fetched or surfaced by search on the date above. Epic's documentation site renders client-side, so several Epic pages came back empty when fetched (glTF export, command-line reference, high-res screenshots, automation overview). Where that happened the claim is marked **[search-snippet]** (taken from a search result excerpt of the official page) or **[unverified]** (known from engine practice but not confirmed against a fetched primary page this session). Verify those before building on them. Unity's current docs line is Unity 6.x (6000.x); the manual pages fetched were versioned 6.6 (beta), 6.5, 6.3 LTS.

## 1. Viewing models and animations outside the editor

### Unity

- **glTF**: Unity's own package `com.unity.cloud.gltfast` (glTFast) claims full glTF 2.0 compliance; import works at runtime and in the Editor; **Editor export is labelled experimental and runtime export "coming soon"** (v6.0.1 docs). First-party, free as a package. Source: https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.0/manual/index.html. Draco, KTX/Basis and meshopt compression supported on import.
- **FBX**: first-party `com.unity.formats.fbx` (FBX Exporter, v5.1.6) exports GameObjects/prefabs and Timeline animation clips to FBX; can record FBX animation in Play mode via the Recorder. It must be installed separately. Source: https://docs.unity3d.com/Packages/com.unity.formats.fbx@5.1/manual/index.html. Scripting API (`ModelExporter`) exists but the manual page does not describe it, so batch use is plausible but not verified here.
- **Batch-mode export**: `-batchmode -nographics -projectPath <p> -executeMethod <Class.Method> -quit` runs a static editor method with no human input. Source: https://docs.unity3d.com/Manual/EditorCommandLineArguments.html. So an adapter can ship an editor script that exports prefabs to FBX/glTF and run it headlessly. Caveat: `-nographics` means no GPU device, so thumbnail rendering needs a graphics-enabled (not `-nographics`) batch run; `AssetPreview` thumbnails also need the editor GUI path.
- **Thumbnails/turntables**: no first-party headless turntable tool found. Practical route is glTF/FBX export, then render in the Studio's own viewer (e.g. three.js `<model-viewer>`), or Recorder in Play mode (section 3).

### Unreal

- **glTF**: first-party, built in (the glTF Exporter). Python API `unreal.GLTFExporter.export_to_gltf(object, path, options, selected_actors)` writes .gltf or .glb; accepted types include `UStaticMesh`, `USkeletalMesh`, `UMaterialInterface`, `UWorld`, `UAnimSequence`, `ULevelSequence`, `ULevelVariantSets`; the Python caller must pass a selected-actors set (can be empty). **[search-snippet]** of https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/GLTFExporter and https://dev.epicgames.com/documentation/unreal-engine/scripting-gltf-exports-in-unreal-engine (the second page fetched empty). `GLTFExportOptions` has mesh quantization (needs `KHR_mesh_quantization`, not loadable in every viewer). Export needs the editor (or editor commandlet run, `UnrealEditor-Cmd -run=pythonscript`: **[unverified]**).
- **FBX**: built-in FBX export from the Content Browser and via Python `AssetExportTask` **[unverified this session]**.
- **Thumbnails/turntables**: Movie Render Queue (first-party, plugin enabled under Edit > Plugins) renders Level Sequences to image sequences (default .jpg 8-bit, can add .png) and can start "Render (Remote)" as a separate process; the launch command is logged for render-farm use. Source: https://dev.epicgames.com/documentation/en-us/unreal-engine/movie-render-pipeline-in-unreal-engine. A turntable is a Level Sequence with an orbiting camera. The exact command-line flags (`-game -MoviePipelineConfig` etc.) were not on the fetched page **[unverified]**.

## 2. Playable builds an external app can show

### Unity

- **WebGL/Web platform**: first-party, ships with the editor. Output is JavaScript + WebAssembly + WebGL, so a Studio can iframe a static build. Limits: no managed threads, no raw sockets / `System.Net`, AOT-only, basic Web Audio, Build and Run server does not cache `.data`, Addressables or AssetBundles. Source: https://docs.unity3d.com/Manual/webgl-technical-overview.html and https://docs.unity3d.com/Manual/webgl-intro.html.
- **WebGPU**: still **experimental** in the 6.x docs (6.1 through 6.6 beta pages); not on by default, opt in via Player Settings graphics APIs with WebGL2 fallback; no async compute, no synchronous GPU readback. Source: https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU-limitations.html (found via search; I did not find a page saying it left experimental).
- **Local executable**: standalone player launched with player command-line args (reference: https://docs.unity3d.com/Manual/PlayerCommandLineArguments.html, not fetched). Studio can spawn it and show output via window capture or an in-game stream; there is no first-party Unity pixel-streaming equivalent found.
- Third-party render streaming exists (Unity Render Streaming package) **[unverified]**.

### Unreal

- **Pixel Streaming**: first-party plugin; runs a packaged UE app on a PC or cloud server and streams frames/audio over WebRTC to a browser; input via keyboard, mouse, touch, gamepad. Infrastructure (Signalling Server, Matchmaker, SFU) is a separate open repo https://github.com/EpicGamesExt/PixelStreamingInfrastructure. Source: https://dev.epicgames.com/documentation/en-us/unreal-engine/pixel-streaming-in-unreal-engine. Needs a GPU machine; Editor streaming is labelled experimental. **Pixel Streaming 2** is the successor, experimental in 5.5; both ship during migration; a vendor reports PS2 video-start problems in 5.5/5.6 (third-party, unverified). The docs do not label Pixel Streaming production vs beta.
- **No first-party WebGL/WASM target**: UE5 dropped HTML5. A browser-embedded Unreal game means Pixel Streaming. **[unverified: confirm no 5.x HTML5 target]**.
- **Local executable**: packaged build launched with `-game`, `-log`, `-ResX/-ResY` (documented: https://dev.epicgames.com/documentation/en-us/unreal-engine/command-line-arguments-in-unreal-engine). Window capture or Pixel Streaming to embed.

## 3. Screenshots and video

- **Unity**: Unity Recorder package (v5.1.7), first-party but installed separately; outputs video, animated GIF, image sequences, EXR AOVs, animation clips, WAV; can be launched from the command line / batch queue; **works only in the Editor in Play mode**. Source: https://docs.unity3d.com/Packages/com.unity.recorder@5.1/manual/index.html. For standalone players, `ScreenCapture.CaptureScreenshot` and the `-screenshot` style args **[unverified]**, or an in-game agent hook.
- **Unreal**: `HighResShot` console command (default 4x res; syntax `HighResShot filename=PATH (XxY | Multiplier) ...`), saved by default to `Saved/Screenshots/<Platform>` (e.g. `Saved\Screenshots\Windows`). **[search-snippet]** of https://dev.epicgames.com/documentation/en-us/unreal-engine/taking-screenshots-in-unreal-engine. Known engine bug reports exist for multiple/duplicate output in 5.0.1. Video: Movie Render Queue (section 1). Use `-ExecCmds="HighResShot ..."` as a launch arg **[unverified]**.
- **Studio-side fallback for both**: OS-level window capture (ffmpeg, ScreenCaptureKit, etc.) of a launched executable. Engine-agnostic, low fidelity, needs a display.

## 4. Reading and driving game state

### Unity

- **Unity MCP server (official)**: part of `com.unity.ai.assistant`; **open beta**; needs Unity 6000.0+, project linked to Unity Cloud, and an active trial or subscription to the Unity AI beta (the blog gives no pricing; a search summary says credits are not consumed, unverified). Exposes scene hierarchy, GameObject/component read-write, C# script edit, console logs, build settings, and custom C# tools. A relay binary at `~/.unity/relay/` is launched by the MCP client with `--mcp`; accept the connection in Project Settings > AI > Unity MCP. Source: https://unity.com/blog/unity-ai-mcp-how-to-get-started and https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-get-started.html. Editor-only; not a runtime-player bridge. Beta terms say features may change or be discontinued.
- **Third-party MCP/editor bridges**: e.g. CoderGamester/mcp-unity (Node WebSocket bridge), Singtaa/UnityMCP (HTTP, port 5173). Community, licence per repo, maturity varies. Source: search listing only.
- **Test Framework (first-party)**: `Unity -runTests -batchmode -projectPath <p> -testPlatform EditMode|PlayMode|<BuildTarget> -testResults <path>`; NUnit XML result, default in project root. Source: https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html. Good for deterministic playtest bots written as Play Mode tests.
- **ML-Agents**: Apache-2.0, Release 23 (Aug 2025), Unity package 4.0.0, Python 1.1.0, verified for Unity 2020.1+; has a Python low-level API to control environments. Source: https://github.com/Unity-Technologies/ml-agents. Needs the game authored with Agent hooks; best for RL bots, heavy for a general adapter.
- **Custom in-game bridge**: a small in-player HTTP/WebSocket server (game-authored) is the only route to drive a running standalone/WebGL build; WebGL cannot open sockets (no `System.Net`), so use JS interop (`window` message hooks) instead.

### Unreal

- **Remote Control API (first-party)**: web server inside the editor/project; HTTP (default 30010) and WebSocket (default 30020); calls Blueprint/Python-exposed functions and reads/writes exposed properties, optionally via Remote Control Presets. **Beta**; the docs advise caution when shipping. Disabled by default in packaged builds and with `-game`; enable with `-RCWebControlEnable -RCWebInterfaceEnable`. Source: https://dev.epicgames.com/documentation/en-us/unreal-engine/remote-control-for-unreal-engine; ports from https://dev.epicgames.com/documentation/en-us/unreal-engine/remote-control-api-websocket-reference-for-unreal-engine and the quick start (search snippet; the quick start the snippet came from was 4.26, so recheck on 5.x; console commands `WebControl.StartServer`, `WebControl.EnableServerOnStartup`).
- **Automation system and Gauntlet (first-party)**: `-ExecCmds="Automation RunTests ..."`; Gauntlet's `RunUAT RunUnreal -test=UE.EditorAutomation|UE.TargetAutomation -project=<uproject> -build=editor|<packaged path>`. Source: https://dev.epicgames.com/documentation/en-us/unreal-engine/running-gauntlet-tests-in-unreal-engine and the Gauntlet overview. Gauntlet needs no game-side code; an optional TestController adds game hooks. Mature, studio-grade.
- **Third-party Unreal MCP servers** exist (e.g. github.com/chir24/unreal_mcp) and mostly wrap Remote Control on 30010/30020. Community quality; treat as optional.
- **Python editor scripting**: first-party; run via `-run=pythonscript` or the Python console **[unverified exact flags]**.

## 5. Default locations for build artifacts, logs, screenshots

| Item | Unity | Unreal |
|---|---|---|
| Editor log | `<Project>/Logs/Editor.log` by default; global: macOS `~/Library/Logs/Unity/Editor.log`, Windows `%LOCALAPPDATA%\Unity\Editor\Editor.log`, Linux `~/.config/unity3d/Editor.log`; override with `-logFile` ([log files](https://docs.unity3d.com/Manual/log-files.html)) | `<Project>/Saved/Logs/*.txt` ([logging](https://dev.epicgames.com/documentation/en-us/unreal-engine/logging-in-unreal-engine)); `-ABSLOG=` override **[unverified]** |
| Player log | macOS `~/Library/Logs/<Company>/<Product>/Player.log`; Windows `%USERPROFILE%\AppData\LocalLow\<Company>\<Product>\Player.log`; Linux `~/.config/unity3d/<Company>/<Product>/Player.log` | Packaged game writes under its own `Saved/Logs` (platform user-data dir **[unverified]**) |
| Build output | Wherever the build script/BuildPlayer target points (no fixed default; common convention `Builds/`) | Packaged/cooked builds to the chosen archive dir; staged builds under `Saved/StagedBuilds` **[unverified]** |
| Screenshots | App-chosen path (`ScreenCapture`), Recorder output set in recorder settings | `Saved/Screenshots/<Platform>` ([taking screenshots](https://dev.epicgames.com/documentation/en-us/unreal-engine/taking-screenshots-in-unreal-engine)) |
| Test results | NUnit XML, project root unless `-testResults` set | Automation reports under `Saved/` (exact path **[unverified]**) |
| MRQ video/frames | n/a | Chosen in Output settings; docs give no default |

## Licence and cost summary

- **Unity**: Personal is free (businesses under $200K revenue/funding in the prior 12 months); Pro is $210/month or from $2,310/year, required above $200K; Enterprise above $25M with custom pricing; Personal lists command-line access. Source: https://unity.com/products/compare-plans (runtime fee not discussed on that page). First-party packages above (FBX, Recorder, Test Framework, glTFast) carry no extra fee. Unity MCP needs a Unity AI beta subscription or trial. ML-Agents is Apache-2.0.
- **Unreal**: engine is free; for games 5% royalty on gross revenue past the first $1,000,000 lifetime per product (quarters under $10,000 excluded; 3.5% under the Launch Everywhere with Epic program; Epic Games Store-processed revenue excluded); free for non-game users below $1M annual revenue. Source: https://www.unrealengine.com/eula/unreal (via search; the licence page itself returned 403 on fetch). Pixel Streaming and Remote Control are bundled plugins with no extra licence found; cloud GPU hosting for streaming is a separate cost.

## Comparison

| Need | Unity | Unreal |
|---|---|---|
| Static model export | FBX Exporter (first-party), glTFast export (experimental) | glTF exporter built-in (Python), FBX built-in |
| Headless batch export | `-batchmode -executeMethod` (mature) | editor commandlet + Python (workable, flags unverified) |
| Playable in browser | Web/WebGL build (mature, static files); WebGPU experimental | Pixel Streaming (needs GPU server, PS2 migration) |
| Playable locally | standalone player exe | packaged exe |
| Screenshots/video | Recorder (editor Play mode only, separate package) | HighResShot, Movie Render Queue |
| Live state bridge | Official MCP (open beta, editor only, subscription) or custom in-game bridge | Remote Control API (Beta, 30010/30020, off in packaged builds by default) |
| Test/bot automation | Test Framework (`-runTests`), ML-Agents | Automation + Gauntlet |
| Cost | Free under $200K, then Pro | Free, 5% over $1M per product |

## What this means for a Game Adapter

**Works from static exported artifacts** (the adapter just points at files, no running engine):
- Model and animation viewing, if the game pipeline exports glTF/GLB (or FBX converted to glTF) into a known folder; the Studio renders them itself.
- Playing a Unity WebGL build (static folder served over HTTP, iframe).
- Playtest reports, screenshots, videos, and logs already written to the default paths in the table; test-result XML/JSON.
- Feedback authoring and storage (Studio-owned).

**Needs a one-shot engine run, not a live bridge** (adapter shells out to the engine CLI, then reads files):
- Exporting assets (`-executeMethod` in Unity, Python in Unreal editor).
- Thumbnails, turntables, and recorded clips (Recorder in Unity, Movie Render Queue in Unreal).
- Running automated test/playtest suites (`-runTests`, Gauntlet) and collecting results.

**Needs a live bridge** (running editor or game process):
- Debug controls and state inspection during play; interactive playtest bots (Unreal Remote Control, Unity MCP in editor, or a game-authored in-player HTTP/WebSocket server).
- Playing an Unreal game in the Studio (Pixel Streaming server plus GPU) or a Unity standalone build embedded as a stream.
- Unity WebGL driving: no sockets, so state must go through JS interop with the iframe.

**Design implications**
- Define Adapter capabilities as optional and capability-negotiated: `exportModels`, `renderThumbnails`, `playEmbedded`, `captureMedia`, `runTests`, `liveState`. A static-only adapter should still be valid.
- Keep a manifest convention (a JSON the engine-side tooling writes next to the artifacts) so the Studio reads static outputs and never parses engine internals.
- Treat both first-party live bridges as unstable: Unity MCP is open beta, Unreal Remote Control is Beta. A thin game-authored bridge (HTTP/JSON) is the engine-neutral lowest common denominator, at the cost of per-game work.
- Plan for gaps flagged **[unverified]** above before committing: Unreal command-line flags for headless capture/MRQ, Unity standalone screenshot args, Unreal HTML5 absence, exact Unreal build/test output paths.
