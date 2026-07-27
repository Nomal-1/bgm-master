# BGM 마스터 (BGM Master)

Foundry VTT용 모듈로, 게임 마스터(GM)가 세션 도중 언제든지 배경음악(BGM)을 자유롭게 전환할 수 있는 **플로팅 리모컨**을 제공합니다.

## 주요 기능

- GM 화면에만 보이는 항상 떠 있는 리모컨 창 (플레이어에게는 보이지 않음)
- 드래그로 위치 이동, 모서리로 크기 조절 가능하고, 위치/크기는 자동 저장되어 재접속 후에도 유지됩니다
- ON/OFF 스위치 하나로 BGM 전환
  - **OFF**: 현재 활성화된 장면(Scene)의 설정(Configure Scene)에서 지정한 기본 Playlist / Playlist Sound가 재생됩니다 (Foundry 기본 동작)
  - **ON**: 장면의 기본 BGM이 즉시 멈추고, 리모컨에서 선택한 플레이리스트/트랙이 대신 재생됩니다 (모든 접속자에게 동일하게 들립니다)
  - 다시 **OFF**로 돌리면 리모컨 BGM이 멈추고 장면 본래의 BGM으로 복귀합니다
- ON 상태에서 리모컨의 트랙/플레이리스트를 바꾸면 재생 중인 곡이 즉시 전환됩니다
- ON 상태에서 GM이 다른 장면을 활성화(Activate)해도 리모컨 BGM이 계속 유지됩니다 (새 장면의 기본 BGM이 끼어들지 않음)

## 설치 방법

1. Foundry VTT의 **Add-on Modules** 화면에서 **Install Module**을 클릭합니다.
2. Manifest URL에 아래 주소를 붙여넣습니다.

   ```
   https://github.com/Nomal-1/bgm-master/releases/latest/download/module.json
   ```

3. 설치 후 사용 중인 월드에서 **BGM 마스터** 모듈을 활성화합니다.

로컬에서 바로 사용하려면 이 폴더 전체를 Foundry의 `Data/modules/bgm-master` 경로에 복사해도 됩니다.

## 사용 방법

1. 각 장면(Scene)의 **Configure Scene** 창에서 평소처럼 기본 BGM(Playlist / Playlist Sound)을 지정해 둡니다. 이것이 리모컨이 OFF일 때 재생되는 곡입니다.
2. GM으로 접속하면 화면에 **BGM 마스터** 리모컨 창이 자동으로 나타납니다.
   - 원하는 위치로 드래그하고, 창 오른쪽 아래 모서리를 드래그해 크기를 조절할 수 있습니다.
   - 창을 닫아도(X) 사라지지 않고 최소화되며, 토큰 컨트롤 툴바의 음표 아이콘을 눌러 다시 펼칠 수 있습니다.
3. 리모컨에서 **Playlist**와 **Track**을 선택해 원할 때 틀고 싶은 BGM을 지정합니다.
4. 스위치를 켜면(ON) 즉시 장면 기본 BGM이 멈추고 지정한 곡이 재생됩니다. 끄면(OFF) 장면 기본 BGM으로 돌아갑니다.

## 요구 사항

- Foundry VTT v12 이상 (v12.331에서 테스트됨)
- 별도의 시스템 의존성 없음

## 라이선스

MIT License. [LICENSE](LICENSE) 참고.
