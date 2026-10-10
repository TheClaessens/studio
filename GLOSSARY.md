# Studio

Vocabulary for the Studio, a local app for using a game project's development Tools. The first source game is [Riftbound](https://github.com/TheClaessens/Riftbound).

**Studio**:
A local app where a human uses a game project's Tools: play the game, view assets, read playtest reports, browse media and docs, and leave Feedback.
_Avoid_: dashboard, editor

**Tool**:
One piece of development tooling grown alongside a game, e.g. the creature viewer, playtest kit or promo renderer.
_Avoid_: utility, script

**Game Adapter**:
The per-game glue that lets a Tool or the Studio reach into a specific game: the set of parts its Project Manifest declares (e.g. an asset catalogue, a play entry, output folders), plus the per-Kit parts the Kits load themselves (e.g. `playtest/adapter.js`, `promo/stage.js`). Mostly data; code only where data can't do the job.
_Avoid_: plugin, integration, bridge

**Kit**:
The game-agnostic half of a Tool (e.g. the playtest core and hands, the promo renderer) that a Game Adapter plugs into. The Studio owns every Kit. A Kit is dev-time only and never ships in a game's release build.
_Avoid_: library, framework, SDK

**Surface**:
One area of the Studio aimed at one kind of work: Assets, Feedback, Play, Playtests, Media or Docs.
_Avoid_: tab, page, module

**Game Project**:
The folder a Studio opens: one game, possibly a subfolder of a larger repo.
_Avoid_: repo, workspace

**Project Manifest**:
The file in a Game Project that tells the Studio which Game Adapter to use, what it can do, and where its outputs live.
_Avoid_: config, settings

**Feedback**:
One human remark with one Pin, written for an agent to pick up. It is open until an agent marks it addressed, and stays addressed until a human closes or reopens it.
_Avoid_: comment, note, annotation

**Pin**:
What a Feedback item points at: an asset, a media file, a playtest report, a doc or a play moment, optionally narrowed by an anchor (pose and frame, timestamp, region, finding, section).
_Avoid_: target, link

**Player Report**:
A bug or idea a player files from inside the game. It is not Feedback.
_Avoid_: player feedback
