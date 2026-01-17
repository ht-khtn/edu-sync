# Olympia Refactor Report (2026-01-14)

## Tóm tắt

- Đã tách actions Olympia thành 4 module: match, permissions, realtime, scoring.
- Đã thêm re-export tại app/(olympia)/olympia/actions.ts để giữ đường dẫn import cũ.
- Không thay đổi logic, thứ tự side-effects, thứ tự gọi DB, hoặc realtime payload.

## Mapping nguồn gốc (actions.ts → file mới)

### actions/olympia/match.actions.ts

| Export                        | Line trong app/(olympia)/olympia/actions.ts |
| ----------------------------- | ------------------------------------------- |
| ActionState                   | L30                                         |
| createMatchAction             | L95                                         |
| deleteMatchAction             | L176                                        |
| createQuestionAction          | L203                                        |
| uploadQuestionSetAction       | L291                                        |
| updateMatchAction             | L5484                                       |
| updateMatchQuestionSetsAction | L5713                                       |
| updateMatchPlayersOrderAction | L5797                                       |
| createMatchRoundsAction       | L5868                                       |
| createParticipantAction       | L5266                                       |
| updateParticipantAction       | L5322                                       |
| deleteParticipantAction       | L5361                                       |
| createTournamentAction        | L5388                                       |
| updateTournamentAction        | L5427                                       |

### actions/olympia/permissions.actions.ts

| Export                          | Line trong app/(olympia)/olympia/actions.ts |
| ------------------------------- | ------------------------------------------- |
| lookupJoinCodeAction            | L402                                        |
| verifyMcPasswordAction          | L482                                        |
| openLiveSessionAction           | L530                                        |
| getSessionPasswordAction        | L634                                        |
| regenerateSessionPasswordAction | L670                                        |
| endLiveSessionAction            | L748                                        |

### actions/olympia/realtime.actions.ts

| Export                                 | Line trong app/(olympia)/olympia/actions.ts |
| -------------------------------------- | ------------------------------------------- |
| setLiveSessionRoundAction              | L796                                        |
| setQuestionStateAction                 | L855                                        |
| startSessionTimerAction                | L977                                        |
| startSessionTimerAutoAction            | L1028                                       |
| expireSessionTimerAction               | L1110                                       |
| startSessionTimerFormAction            | L1155                                       |
| setWaitingScreenAction                 | L1159                                       |
| setBuzzerEnabledAction                 | L1200                                       |
| setScoreboardOverlayAction             | L1239                                       |
| setScoreboardOverlayFormAction         | L1279                                       |
| setAnswersOverlayAction                | L1283                                       |
| setAnswersOverlayFormAction            | L1322                                       |
| submitAnswerAction                     | L1610                                       |
| triggerBuzzerAction                    | L1855                                       |
| selectVeDichPackageAction              | L2084                                       |
| selectVeDichPackageFormAction          | L2305                                       |
| selectVeDichPackageClientAction        | L2309                                       |
| setGuestMediaControlAction             | L2675                                       |
| setGuestMediaControlFormAction         | L2776                                       |
| setCurrentQuestionAction               | L2843                                       |
| setCurrentQuestionFormAction           | L3011                                       |
| advanceCurrentQuestionAction           | L3015                                       |
| advanceCurrentQuestionFormAction       | L3343                                       |
| setRoundQuestionTargetPlayerAction     | L4398                                       |
| setRoundQuestionTargetPlayerFormAction | L4549                                       |

### actions/olympia/scoring.actions.ts

| Export                               | Line trong app/(olympia)/olympia/actions.ts |
| ------------------------------------ | ------------------------------------------- |
| resetMatchScoresAction               | L1326                                       |
| editMatchScoreManualAction           | L1366                                       |
| resetLiveSessionAndScoresAction      | L1491                                       |
| confirmDecisionAction                | L2316                                       |
| confirmDecisionFormAction            | L2665                                       |
| confirmDecisionVoidFormAction        | L2671                                       |
| confirmDecisionAndAdvanceAction      | L2780                                       |
| confirmDecisionAndAdvanceFormAction  | L2839                                       |
| manualAdjustScoreAction              | L3515                                       |
| manualAdjustScoreFormAction          | L3571                                       |
| undoLastScoreChangeAction            | L3583                                       |
| undoLastScoreChangeFormAction        | L3683                                       |
| submitObstacleGuessAction            | L3687                                       |
| submitObstacleGuessByHostFormAction  | L3697                                       |
| confirmVcnvRowDecisionAction         | L3777                                       |
| confirmVcnvRowDecisionFormAction     | L3961                                       |
| confirmObstacleGuessAction           | L3965                                       |
| confirmObstacleGuessFormAction       | L4176                                       |
| markAnswerCorrectnessAction          | L4180                                       |
| markAnswerCorrectnessFormAction      | L4218                                       |
| autoScoreTangTocAction               | L4222                                       |
| autoScoreTangTocFormAction           | L4340                                       |
| setVeDichQuestionValueAction         | L4344                                       |
| setVeDichQuestionValueFormAction     | L4394                                       |
| confirmDecisionsBatchAction          | L4553                                       |
| confirmDecisionsBatchFormAction      | L4720                                       |
| toggleStarUseAction                  | L4730                                       |
| toggleStarUseFormAction              | L4777                                       |
| openStealWindowAction                | L4781                                       |
| openStealWindowFormAction            | L4822                                       |
| confirmVeDichMainDecisionAction      | L4833                                       |
| confirmVeDichMainDecisionFormAction  | L4998                                       |
| confirmVeDichStealDecisionAction     | L5002                                       |
| confirmVeDichStealDecisionFormAction | L5222                                       |

## Xác nhận preserve behavior

- Không đổi logic, thứ tự side-effects, và các thao tác DB.
- Không thay đổi realtime payload, channel, filter, hoặc thứ tự phát.
- Không thay đổi contract public (tên export, chữ ký hàm, kiểu trả về).

## Checklist realtime

- [x] Không đổi channel
- [x] Không đổi filter
- [x] Không đổi payload shape
- [x] Không đổi thứ tự broadcast/emit
- [x] Không buffering/batching
