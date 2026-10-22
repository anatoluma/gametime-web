# 2026/27 player-stats audit and repair plan (read-only)

Generated 2026-10-22T08:22:30.894Z. Nothing was modified; SQL files were not executed.

## 1. Team score vs stored player points

| game_id | team | score | stored | difference | rows |
|---|---|---|---|---|---|
| g_2026_09_13_AMB_CN2 | AMB | 52 | 48 | 4 | 9 |
| g_2026_09_13_AMB_CN2 | CN2 | 85 | 69 | 16 | 7 |
| g_2026_09_13_GTM_BLD | BLD | 47 | 0 | 47 | 0 |
| g_2026_09_27_BLD_HAI | BLD | 55 | 0 | 55 | 0 |
| g_2026_09_27_BLD_HAI | HAI | 59 | 51 | 8 | 6 |
| g_2026_09_27_AMB_EDI | AMB | 69 | 58 | 11 | 10 |
| g_2026_09_27_CAS_ADM | CAS | 89 | 81 | 8 | 11 |
| g_2026_10_04_EDI_CAS | CAS | 76 | 72 | 4 | 9 |
| g_2026_10_04_GTM_COM | COM | 65 | 52 | 13 | 4 |
| g_2026_10_04_BLD_AMB | AMB | 50 | 45 | 5 | 9 |
| g_2026_10_11_CAS_BLD | CAS | 91 | 83 | 8 | 10 |
| g_2026_10_11_CAS_BLD | BLD | 61 | 0 | 61 | 0 |
| g_2026_10_11_AMB_WOL | AMB | 69 | 61 | 8 | 7 |
| g_2026_10_18_GTM_HAI | HAI | 59 | 49 | 10 | 7 |
| g_2026_10_18_CN2_EDI | CN2 | 88 | 84 | 4 | 7 |

## 2. Totals

```json
{
  "sum_discrepancies": 15,
  "insert": 49,
  "reassign": 29,
  "update": 0,
  "unchanged": 313,
  "manual_review": 47,
  "games_fully_automatic": 4
}
```

## 3. Unambiguous corrections (insert / reassign / update)

### g_2026_09_13_USM_WOL (USM 84-49 WOL), job 13d73a34

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| WOL | 5 Burdeja I | p0208 Igor Burduja (from 97e8af72-b2a6-412b-879e-b8a0d2b9fb9d) | reassign | medium | 4 | 4 | Stats are stored under 97e8af72-b2a6-412b-879e-b8a0d2b9fb9d (Alexandr Culicovschi) but the resolved roster player is p0208 (Igor Burduja); the stat line is identical, so only player_id changes. |
| WOL | 7 Secrieru V | p0161 Vadim Secrieru (from p0077) | reassign | medium | 8 | 8 | Stats are stored under p0077 (Taras Blajco) but the resolved roster player is p0161 (Vadim Secrieru); the stat line is identical, so only player_id changes. |

### g_2026_09_13_AMB_CN2 (AMB 52-85 CN2), job 83bbe6da

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| AMB | 2 VisneakovN | p0250 Nichita Visneacov (from p0218) | reassign | medium | 4 | 4 | Stats are stored under p0218 (N Vishineacov) but the resolved roster player is p0250 (Nichita Visneacov); the stat line is identical, so only player_id changes. |
| AMB | 55 Golovco I | p0007 Ion Golovco | insert | medium | 4 |  | No stored row for this resolved player; extraction has the stat line. |
| CN2 | 16 MartinovU | p0222 V Martanov | insert | medium | 6 |  | No stored row for this resolved player; extraction has the stat line. |
| CN2 | 17 Tonchu A | p0021 Alic Tonciu | insert | medium | 10 |  | No stored row for this resolved player; extraction has the stat line. |
| CN2 | 23 Toroghi V | p0224 V Jeregi | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |

### g_2026_09_13_EDI_DRO (EDI 49-85 DRO), job d6bd43b0

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| EDI | 3 Denis P | 95c4aaea-e486-41f8-8dfd-5b6cd3359663 Denis Palataicov (from p0104) | reassign | medium | 2 | 2 | Stats are stored under p0104 (Andrei Dragutan) but the resolved roster player is 95c4aaea-e486-41f8-8dfd-5b6cd3359663 (Denis Palataicov); the stat line is identical, so only player_id changes. |
| EDI | 8 Alexandr U | p0163 Alexandru Gronic (from p0106) | reassign | medium | 6 | 6 | Stats are stored under p0106 (Alexandr Ulianici) but the resolved roster player is p0163 (Alexandru Gronic); the stat line is identical, so only player_id changes. |
| EDI | 14 Dorin B | 12f37ef9-2c89-4fa3-b77d-dc954da6a474 Dorin Bocancea (from p0110) | reassign | medium | 10 | 10 | Stats are stored under p0110 (Vasile Speian) but the resolved roster player is 12f37ef9-2c89-4fa3-b77d-dc954da6a474 (Dorin Bocancea); the stat line is identical, so only player_id changes. |
| EDI | 88 Andrei R | b96c2125-601b-4900-9e95-84f362d3de30 Andrei Rusu (from 2a79386c-6451-4fb9-9f79-a56586022ffd) | reassign | medium | 18 | 18 | Stats are stored under 2a79386c-6451-4fb9-9f79-a56586022ffd (Stanislav Kosih) but the resolved roster player is b96c2125-601b-4900-9e95-84f362d3de30 (Andrei Rusu); the stat line is identical, so only player_id changes. |
| DRO | 4 ilia C | p0061 Ion Iatco (from 7869f453-98b9-4864-b60f-d8eb914aff6a) | reassign | medium | 0 | 0 | Stats are stored under 7869f453-98b9-4864-b60f-d8eb914aff6a (Daniel Chislin) but the resolved roster player is p0061 (Ion Iatco); the stat line is identical, so only player_id changes. |
| DRO | 6 Matvei B | 58587871-e92c-4526-8416-e9226078ebfc Matei Barbara (from p0056) | reassign | medium | 0 | 0 | Stats are stored under p0056 (Stefan Codreanu) but the resolved roster player is 58587871-e92c-4526-8416-e9226078ebfc (Matei Barbara); the stat line is identical, so only player_id changes. |
| DRO | 7 Ivan .M | c9e3440b-6179-4bda-849c-9df0331c0c62 Ion Mitisov (from p0064) | reassign | medium | 39 | 39 | Stats are stored under p0064 (V Croitoru) but the resolved roster player is c9e3440b-6179-4bda-849c-9df0331c0c62 (Ion Mitisov); the stat line is identical, so only player_id changes. |
| DRO | 8 Marius C | p0157 Marius Stina (from 1825d196-6afa-4456-b074-164eda037668) | reassign | medium | 2 | 2 | Stats are stored under 1825d196-6afa-4456-b074-164eda037668 (A Moraru) but the resolved roster player is p0157 (Marius Stina); the stat line is identical, so only player_id changes. |
| DRO | 11 Ivan I | p0062 V Panaite (from p0061) | reassign | medium | 12 | 12 | Stats are stored under p0061 (Ion Iatco) but the resolved roster player is p0062 (V Panaite); the stat line is identical, so only player_id changes. |
| DRO | 14 Andrei P | 877960cb-8870-4469-b894-7fbf9d8f44ca A Hirbu (from p0158) | reassign | medium | 3 | 3 | Stats are stored under p0158 (Bogdan Gitu) but the resolved roster player is 877960cb-8870-4469-b894-7fbf9d8f44ca (A Hirbu); the stat line is identical, so only player_id changes. |

### g_2026_09_13_GTM_BLD (GTM 78-47 BLD), job 8496970e

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| BLD | 8 Roman P | 43a359a1-4bfd-4715-bc50-28c564f101c1 Roman Pisariuc | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 9 Nichita C | ee6c9ceb-f22e-4f4f-afcd-62971da4671e Nichita Ciorba | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 10 Serghei C | p0067 S Coscodan | insert | medium | 6 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 11 Sergiu B | p0068 S Buruiana | insert | medium | 4 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 12 Denis B | p0201 Denis Bostan | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 13 Roman M | 0964080c-3e6a-4c4d-b937-491d20c871f0 Roman Mosenschii | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 17 Andreai S | p0070 A Slobodean | insert | medium | 6 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 24 Alexander S | p0071 Alexander Saenco | insert | medium | 1 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 30 Victor S | f3afe091-8f9f-4d7d-9915-9f9212dfd5bd Vactor Stoicov | insert | medium | 17 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 71 Dmitrii T | p0073 D Tcaciov | insert | medium | 9 |  | No stored row for this resolved player; extraction has the stat line. |

### g_2026_09_20_WOL_GTM (WOL 69-79 GTM), job 8e62803e

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| WOL | 5 Burduja I | p0208 Igor Burduja (from 97e8af72-b2a6-412b-879e-b8a0d2b9fb9d) | reassign | medium | 5 | 5 | Stats are stored under 97e8af72-b2a6-412b-879e-b8a0d2b9fb9d (Alexandr Culicovschi) but the resolved roster player is p0208 (Igor Burduja); the stat line is identical, so only player_id changes. |
| WOL | 7 Secrieru V | p0161 Vadim Secrieru (from p0077) | reassign | medium | 2 | 2 | Stats are stored under p0077 (Taras Blajco) but the resolved roster player is p0161 (Vadim Secrieru); the stat line is identical, so only player_id changes. |

### g_2026_09_27_BLD_HAI (BLD 55-59 HAI), job 41f8b794

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| BLD | 4 Tonchu N | p0212 Nichita Tonciu | insert | medium | 2 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 5 Revazov I | p0066 I Revazov | insert | medium | 2 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 7 Levitchii A | ae90fc95-7497-4eb4-b5ef-2d634d237204 Artiom Levitchii | insert | medium | 1 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 8 Tonchu A | 0fd7ff3f-3740-49a2-b634-68137bebd31c Artur Tonciu | insert | medium | 7 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 9 Ciorba N | ee6c9ceb-f22e-4f4f-afcd-62971da4671e Nichita Ciorba | insert | medium | 11 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 11 Burujana S | p0068 S Buruiana | insert | medium | 7 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 13 Mosenschiivi R | 0964080c-3e6a-4c4d-b937-491d20c871f0 Roman Mosenschii | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 17 Popovichi M | p0204 M Popovici | insert | medium | 4 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 30 Stoicov V | f3afe091-8f9f-4d7d-9915-9f9212dfd5bd Vactor Stoicov | insert | medium | 17 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 71 Tcaciov D | p0073 D Tcaciov | insert | medium | 4 |  | No stored row for this resolved player; extraction has the stat line. |
| HAI | 14 Alexandr K | p0145 Alexandr Kalashnikov | insert | medium | 8 |  | No stored row for this resolved player; extraction has the stat line. |

### g_2026_09_27_CAS_ADM (CAS 89-50 ADM), job acb9d7d3

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| ADM | 13 A TURCANU | p0255 Alexei Turcanu (from p0131) | reassign | medium | 0 | 0 | Stats are stored under p0131 (M Cernei) but the resolved roster player is p0255 (Alexei Turcanu); the stat line is identical, so only player_id changes. |
| ADM | 69 I EPUREANU | p0124 Ianis Epureanu (from p0134) | reassign | medium | 7 | 7 | Stats are stored under p0134 (N Vitneanschii) but the resolved roster player is p0124 (Ianis Epureanu); the stat line is identical, so only player_id changes. |

### g_2026_10_04_EDI_CAS (EDI 57-76 CAS), job c5c36635

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| EDI | 13 AlexandrG | p0163 Alexandru Gronic (from 2d0c1f78-2d2b-42e1-891f-b7a79506c188) | reassign | medium | 0 | 0 | Stats are stored under 2d0c1f78-2d2b-42e1-891f-b7a79506c188 (Polubok Ghiorghi) but the resolved roster player is p0163 (Alexandru Gronic); the stat line is identical, so only player_id changes. |
| CAS | 0 Danila I | p0252 Danila Kravchenko (from p0228) | reassign | medium | 9 | 9 | Stats are stored under p0228 (D Iarovoi) but the resolved roster player is p0252 (Danila Kravchenko); the stat line is identical, so only player_id changes. |
| CAS | 11 Alexandr S | p0232 A Gorodeev (from p0231) | reassign | medium | 2 | 2 | Stats are stored under p0231 (A Sedoi) but the resolved roster player is p0232 (A Gorodeev); the stat line is identical, so only player_id changes. |
| CAS | 12 Artem G | p0234 V Graur (from p0232) | reassign | medium | 0 | 0 | Stats are stored under p0232 (A Gorodeev) but the resolved roster player is p0234 (V Graur); the stat line is identical, so only player_id changes. |
| CAS | 15 Semen G | p0251 Semen Goldstein | insert | medium | 4 |  | No stored row for this resolved player; extraction has the stat line. |
| CAS | 16 Stanislav G | p0254 Stanislav Goldstein | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| CAS | 77 Dmitrii S | p0228 D Iarovoi (from p0235) | reassign | medium | 0 | 0 | Stats are stored under p0235 (D Slobodean) but the resolved roster player is p0228 (D Iarovoi); the stat line is identical, so only player_id changes. |
| CAS | 99 Martin G | p0253 Martin Arzumanian | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |

### g_2026_10_04_GTM_COM (GTM 80-65 COM), job 412be072

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| COM | 0 Victor L | p0240 Victor Leiciu | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| COM | 4 Vladimir D | p0236 Vladimir Dimoglo | insert | medium | 9 |  | No stored row for this resolved player; extraction has the stat line. |
| COM | 6 Daniil D | p0237 Daniil Dimitroglo | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| COM | 12 Roman B | p0239 Roman Barladean | insert | medium | 2 |  | No stored row for this resolved player; extraction has the stat line. |
| COM | 24 Stepan P | p0246 Stepan Peadisev | insert | medium | 2 |  | No stored row for this resolved player; extraction has the stat line. |

### g_2026_10_04_BLD_AMB (BLD 57-50 AMB), job c3d52bbd

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| BLD | 7 ALEVITCHI | ae90fc95-7497-4eb4-b5ef-2d634d237204 Artiom Levitchii | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 8 A SLOBODEANU | p0070 A Slobodean | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 24 A SACENCO | p0071 Alexander Saenco | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| AMB | 45 N VISHNEACOV | p0218 N Vishineacov (from p0220) | reassign | medium | 0 | 0 | Stats are stored under p0220 (A Huba) but the resolved roster player is p0218 (N Vishineacov); the stat line is identical, so only player_id changes. |

### g_2026_10_11_CAS_BLD (CAS 91-61 BLD), job 1b34d14e

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| CAS | 15 Semen G | p0251 Semen Goldstein | insert | medium | 8 |  | No stored row for this resolved player; extraction has the stat line. |
| CAS | 42 * * | p0252 Danila Kravchenko (from p0234) | reassign | medium | 2 | 2 | Stats are stored under p0234 (V Graur) but the resolved roster player is p0252 (Danila Kravchenko); the stat line is identical, so only player_id changes. |
| CAS | 99 Martin G | p0253 Martin Arzumanian | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 4 Nichita T | p0212 Nichita Tonciu | insert | medium | 2 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 7 Roman P | 67e824d0-2029-4ece-8aa1-9178de2c566e Petea Romanov | insert | medium | 2 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 9 Nichita C | ee6c9ceb-f22e-4f4f-afcd-62971da4671e Nichita Ciorba | insert | medium | 15 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 13 Roma M | 43a359a1-4bfd-4715-bc50-28c564f101c1 Roman Pisariuc | insert | medium | 2 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 23 Alexandr R | p0213 Alex Rencev | insert | medium | 3 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 24 Alrxandr S | p0071 Alexander Saenco | insert | medium | 4 |  | No stored row for this resolved player; extraction has the stat line. |
| BLD | 71 Dmitrii T | p0073 D Tcaciov | insert | medium | 2 |  | No stored row for this resolved player; extraction has the stat line. |

### g_2026_10_11_AMB_WOL (AMB 69-87 WOL), job 61e9ec91

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| AMB | 45 N Vishneakov | p0218 N Vishineacov | insert | medium | 8 |  | No stored row for this resolved player; extraction has the stat line. |
| WOL | 7 V Secrieru | p0161 Vadim Secrieru (from p0077) | reassign | medium | 19 | 19 | Stats are stored under p0077 (Taras Blajco) but the resolved roster player is p0161 (Vadim Secrieru); the stat line is identical, so only player_id changes. |

### g_2026_10_11_GTM_DRO (GTM 65-70 DRO), job 44c420c4

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| DRO | 7 I MITISOR | c9e3440b-6179-4bda-849c-9df0331c0c62 Ion Mitisov (from p0064) | reassign | medium | 17 | 17 | Stats are stored under p0064 (V Croitoru) but the resolved roster player is c9e3440b-6179-4bda-849c-9df0331c0c62 (Ion Mitisov); the stat line is identical, so only player_id changes. |

### g_2026_10_18_GTM_HAI (GTM 63-59 HAI), job 3019a13f

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| HAI | 10 E Salcutan | p0041 Egor Salcutan (from 9c211e0a-5b25-4695-b47c-4a05a0363d8b) | reassign | medium | 1 | 1 | Stats are stored under 9c211e0a-5b25-4695-b47c-4a05a0363d8b (K Gorbuli) but the resolved roster player is p0041 (Egor Salcutan); the stat line is identical, so only player_id changes. |
| HAI | 14 A Kalasnicov | p0145 Alexandr Kalashnikov | insert | medium | 10 |  | No stored row for this resolved player; extraction has the stat line. |
| HAI | 35 K Gorbuli | 9c211e0a-5b25-4695-b47c-4a05a0363d8b K Gorbuli (from p0053) | reassign | medium | 2 | 2 | Stats are stored under p0053 (Oleg Greciuschin) but the resolved roster player is 9c211e0a-5b25-4695-b47c-4a05a0363d8b (K Gorbuli); the stat line is identical, so only player_id changes. |

### g_2026_10_18_CN2_EDI (CN2 88-54 EDI), job 20a9143a

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| CN2 | 11 T CUCERAVII | p0249 Genadii Kuceriavii | insert | medium | 4 |  | No stored row for this resolved player; extraction has the stat line. |
| CN2 | 18 D SFAPTI | p0227 A Streapko (from p0224) | reassign | medium | 0 | 0 | Stats are stored under p0224 (V Jeregi) but the resolved roster player is p0227 (A Streapko); the stat line is identical, so only player_id changes. |

### g_2026_10_18_WOL_CAS (WOL 74-90 CAS), job 6000968c

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| CAS | 99 MArzumanean | p0253 Martin Arzumanian | insert | medium | 0 |  | No stored row for this resolved player; extraction has the stat line. |

## 4. Requires manual identity confirmation

### g_2026_09_13_USM_WOL (USM 84-49 WOL), job 13d73a34

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| USM | 7 STripliciuc | 6a924d9f-5d30-4cc2-9f2b-df85fa4519bf  | manual review | n/a |  |  | not_in_season_roster: USM #7 STripliciuc resolves to 6a924d9f-5d30-4cc2-9f2b-df85fa4519bf "Serghei Tipliciuc", who has no active 2026/27 roster registration. Register the player for USM in 2026/27 (admin players page) or pick another player. |
| USM |   | 6a924d9f-5d30-4cc2-9f2b-df85fa4519bf Serghei Tipliciuc | manual review | n/a |  | 6 | Stored row for Serghei Tipliciuc has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_09_13_EDI_DRO (EDI 49-85 DRO), job d6bd43b0

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| EDI | 13 Georgiy P | p0215  | manual review | n/a |  |  | not_in_season_roster: EDI #13 Georgiy P resolves to p0215 "A Ghiorghiev", who has no active 2026/27 roster registration. Register the player for EDI in 2026/27 (admin players page) or pick another player. |
| EDI |   | 2d0c1f78-2d2b-42e1-891f-b7a79506c188 Polubok Ghiorghi | manual review | n/a |  | 0 | Stored row for Polubok Ghiorghi has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_09_13_GTM_BLD (GTM 78-47 BLD), job 8496970e

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| BLD | 4 Maxim P |   | manual review | n/a |  |  | unresolved_player: BLD #4 Maxim P is not resolved to a player. Select the correct roster player (or register a new one) in the review page. |

### g_2026_09_20_ADM_AMB (ADM 54-83 AMB), job 820d59b4

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| ADM | 77 COMNATNII G | p0122  | manual review | n/a |  |  | not_in_season_roster: ADM #77 COMNATNII G resolves to p0122 "G ComnatnIi", who has no active 2026/27 roster registration. Register the player for ADM in 2026/27 (admin players page) or pick another player. |
| ADM |   | p0135 Gleb Comnotnii | manual review | n/a |  | 0 | Stored row for Gleb Comnotnii has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_09_27_GTM_USM (GTM 81-58 USM), job 32d9aba5

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| USM | 2 Godunov N | 059a475d-4d0b-4dab-b28e-f536f5229e47  | manual review | n/a |  |  | not_in_season_roster: USM #2 Godunov N resolves to 059a475d-4d0b-4dab-b28e-f536f5229e47 "Nichita Godunov", who has no active 2026/27 roster registration. Register the player for USM in 2026/27 (admin players page) or pick another player. |
| USM |   | 059a475d-4d0b-4dab-b28e-f536f5229e47 Nichita Godunov | manual review | n/a |  | 4 | Stored row for Nichita Godunov has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_09_27_BLD_HAI (BLD 55-59 HAI), job 41f8b794

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| HAI | 3 Stanislav B | fef895dd-9b4f-488c-9711-af6fb6b2c2ea  | manual review | n/a |  |  | not_in_season_roster: HAI #3 Stanislav B resolves to fef895dd-9b4f-488c-9711-af6fb6b2c2ea "Stanislav Basiul", who has no active 2026/27 roster registration. Register the player for HAI in 2026/27 (admin players page) or pick another player. |
| HAI | 23 Iroslav S | 694ca4d0-c501-4807-b384-aaaeab251cdb  | manual review | n/a |  |  | not_in_season_roster: HAI #23 Iroslav S resolves to 694ca4d0-c501-4807-b384-aaaeab251cdb "Svenk Iaroslav", who has no active 2026/27 roster registration. Register the player for HAI in 2026/27 (admin players page) or pick another player. |
| HAI |   | 694ca4d0-c501-4807-b384-aaaeab251cdb Svenk Iaroslav | manual review | n/a |  | 0 | Stored row for Svenk Iaroslav has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |
| HAI |   | fef895dd-9b4f-488c-9711-af6fb6b2c2ea Stanislav Basiul | manual review | n/a |  | 13 | Stored row for Stanislav Basiul has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_09_27_AMB_EDI (AMB 69-45 EDI), job 4faf3012

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| AMB | 17 S Carabet | p0168  | manual review | n/a |  |  | not_in_season_roster: AMB #17 S Carabet resolves to p0168 "S Carabet", who has no active 2026/27 roster registration. Register the player for AMB in 2026/27 (admin players page) or pick another player. |

### g_2026_09_27_CAS_ADM (CAS 89-50 ADM), job acb9d7d3

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| ADM | 77 G COMNATNAII | p0122  | manual review | n/a |  |  | not_in_season_roster: ADM #77 G COMNATNAII resolves to p0122 "G ComnatnIi", who has no active 2026/27 roster registration. Register the player for ADM in 2026/27 (admin players page) or pick another player. |
| CAS |   | p0251  | manual review | n/a |  |  | duplicate_player: CAS #15 S GOLDSTEIN and CAS #16 S GOLDSTEIN are all mapped to p0251 "Semen Goldstein". Each box-score row needs a different player; fix the mapping in the review page. |
| CAS |   | p0254 Stanislav Goldstein | manual review | n/a |  | 2 | Stored row for Stanislav Goldstein has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |
| ADM |   | p0135 Gleb Comnotnii | manual review | n/a |  | 3 | Stored row for Gleb Comnotnii has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_10_04_EDI_CAS (EDI 57-76 CAS), job c5c36635

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| CAS | 19 Pavel P | p0001  | manual review | n/a |  |  | not_in_season_roster: CAS #19 Pavel P resolves to p0001 "Pavel TIbrigan", who has no active 2026/27 roster registration. Register the player for CAS in 2026/27 (admin players page) or pick another player. |
| CAS |   | p0233 P Pedcenko | manual review | n/a |  | 6 | Stored row for P Pedcenko has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_10_04_GTM_COM (GTM 80-65 COM), job 412be072

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| COM | 15 Dmitrii K | cf6ed7cc-f66c-4f58-8384-eeac019adf1c  | manual review | n/a |  |  | not_in_season_roster: COM #15 Dmitrii K resolves to cf6ed7cc-f66c-4f58-8384-eeac019adf1c "Dmitrii K", who has no active 2026/27 roster registration. Register the player for COM in 2026/27 (admin players page) or pick another player. |
| COM |   | cf6ed7cc-f66c-4f58-8384-eeac019adf1c Dmitrii K | manual review | n/a |  | 11 | Stored row for Dmitrii K has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_10_04_USM_DRO (USM 63-73 DRO), job a62b0ac0

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| USM | 2 N GORDUNOV | 059a475d-4d0b-4dab-b28e-f536f5229e47  | manual review | n/a |  |  | not_in_season_roster: USM #2 N GORDUNOV resolves to 059a475d-4d0b-4dab-b28e-f536f5229e47 "Nichita Godunov", who has no active 2026/27 roster registration. Register the player for USM in 2026/27 (admin players page) or pick another player. |
| USM | 7 S TIPLICIUC | 6a924d9f-5d30-4cc2-9f2b-df85fa4519bf  | manual review | n/a |  |  | not_in_season_roster: USM #7 S TIPLICIUC resolves to 6a924d9f-5d30-4cc2-9f2b-df85fa4519bf "Serghei Tipliciuc", who has no active 2026/27 roster registration. Register the player for USM in 2026/27 (admin players page) or pick another player. |
| USM | 9 C CRISTALOV | 00c1f9fd-4508-42bb-9ed9-602349602d2b  | manual review | n/a |  |  | not_in_season_roster: USM #9 C CRISTALOV resolves to 00c1f9fd-4508-42bb-9ed9-602349602d2b "C Cristalov", who has no active 2026/27 roster registration. Register the player for USM in 2026/27 (admin players page) or pick another player. |
| USM | 16 M DIDURAC | f79a0f6f-67e2-4d11-a654-052b46158d6c  | manual review | n/a |  |  | not_in_season_roster: USM #16 M DIDURAC resolves to f79a0f6f-67e2-4d11-a654-052b46158d6c "M Didurac", who has no active 2026/27 roster registration. Register the player for USM in 2026/27 (admin players page) or pick another player. |
| DRO | 15 V DRANNICOV | 10516724-1471-4a2d-bbe4-1670c515f307  | manual review | n/a |  |  | not_in_season_roster: DRO #15 V DRANNICOV resolves to 10516724-1471-4a2d-bbe4-1670c515f307 "V Drannicov", who has no active 2026/27 roster registration. Register the player for DRO in 2026/27 (admin players page) or pick another player. |
| USM |   | 00c1f9fd-4508-42bb-9ed9-602349602d2b C Cristalov | manual review | n/a |  | 11 | Stored row for C Cristalov has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |
| USM |   | 059a475d-4d0b-4dab-b28e-f536f5229e47 Nichita Godunov | manual review | n/a |  | 0 | Stored row for Nichita Godunov has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |
| USM |   | 6a924d9f-5d30-4cc2-9f2b-df85fa4519bf Serghei Tipliciuc | manual review | n/a |  | 6 | Stored row for Serghei Tipliciuc has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |
| USM |   | f79a0f6f-67e2-4d11-a654-052b46158d6c M Didurac | manual review | n/a |  | 0 | Stored row for M Didurac has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |
| DRO |   | 10516724-1471-4a2d-bbe4-1670c515f307 V Drannicov | manual review | n/a |  | 5 | Stored row for V Drannicov has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_10_04_BLD_AMB (BLD 57-50 AMB), job c3d52bbd

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| AMB | 0 S CARABET | p0168  | manual review | n/a |  |  | not_in_season_roster: AMB #0 S CARABET resolves to p0168 "S Carabet", who has no active 2026/27 roster registration. Register the player for AMB in 2026/27 (admin players page) or pick another player. |

### g_2026_10_11_CAS_BLD (CAS 91-61 BLD), job 1b34d14e

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| CAS | 19 Pavel P | p0001  | manual review | n/a |  |  | not_in_season_roster: CAS #19 Pavel P resolves to p0001 "Pavel TIbrigan", who has no active 2026/27 roster registration. Register the player for CAS in 2026/27 (admin players page) or pick another player. |
| CAS | 52 Alexei B | p0008  | manual review | n/a |  |  | not_in_season_roster: CAS #52 Alexei B resolves to p0008 "Alexandr Ceaicovschii", who has no active 2026/27 roster registration. Register the player for CAS in 2026/27 (admin players page) or pick another player. |
| BLD | 5 Iaroslav R | p0069  | manual review | n/a |  |  | not_in_season_roster: BLD #5 Iaroslav R resolves to p0069 "T Elizarov", who has no active 2026/27 roster registration. Register the player for BLD in 2026/27 (admin players page) or pick another player. |
| BLD | 8 Andrei S |   | manual review | n/a |  |  | unresolved_player: BLD #8 Andrei S is not resolved to a player. Select the correct roster player (or register a new one) in the review page. |
| BLD | 11 Sergiu B |   | manual review | n/a |  |  | unresolved_player: BLD #11 Sergiu B is not resolved to a player. Select the correct roster player (or register a new one) in the review page. |
| BLD | 17 Maxim P |   | manual review | n/a |  |  | unresolved_player: BLD #17 Maxim P is not resolved to a player. Select the correct roster player (or register a new one) in the review page. |
| CAS | 11 Alexandr S | p0009 A Bogatireov | manual review | n/a | 3 | 3 | Stored row under p0231 (A Sedoi) has this player's exact stats, but target id is occupied by an unrelated stored row. |
| CAS |   | p0233 P Pedcenko | manual review | n/a |  | 0 | Stored row for P Pedcenko has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_10_11_AMB_WOL (AMB 69-87 WOL), job 61e9ec91

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| AMB | 16 S Bodorin | d49fdb77-67f2-4484-ae1a-0010e265b829  | manual review | n/a |  |  | not_in_season_roster: AMB #16 S Bodorin resolves to d49fdb77-67f2-4484-ae1a-0010e265b829 "Serghei Bodorin", who has no active 2026/27 roster registration. Register the player for AMB in 2026/27 (admin players page) or pick another player. |
| AMB |   | d49fdb77-67f2-4484-ae1a-0010e265b829 Serghei Bodorin | manual review | n/a |  | 9 | Stored row for Serghei Bodorin has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_10_11_GTM_DRO (GTM 65-70 DRO), job 44c420c4

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| DRO | 15 V DRONICOV | 10516724-1471-4a2d-bbe4-1670c515f307  | manual review | n/a |  |  | not_in_season_roster: DRO #15 V DRONICOV resolves to 10516724-1471-4a2d-bbe4-1670c515f307 "V Drannicov", who has no active 2026/27 roster registration. Register the player for DRO in 2026/27 (admin players page) or pick another player. |
| DRO |   | 10516724-1471-4a2d-bbe4-1670c515f307 V Drannicov | manual review | n/a |  | 3 | Stored row for V Drannicov has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

### g_2026_10_18_GTM_HAI (GTM 63-59 HAI), job 3019a13f

| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |
|---|---|---|---|---|---|---|---|
| HAI | 3 S Bosiul | fef895dd-9b4f-488c-9711-af6fb6b2c2ea  | manual review | n/a |  |  | not_in_season_roster: HAI #3 S Bosiul resolves to fef895dd-9b4f-488c-9711-af6fb6b2c2ea "Stanislav Basiul", who has no active 2026/27 roster registration. Register the player for HAI in 2026/27 (admin players page) or pick another player. |
| HAI |   | fef895dd-9b4f-488c-9711-af6fb6b2c2ea Stanislav Basiul | manual review | n/a |  | 11 | Stored row for Stanislav Basiul has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically. |

## 5. Post-repair prediction per game

| game | team | score | predicted sum | reconciles |
|---|---|---|---|---|
| g_2026_09_13_USM_WOL | USM | 84 | 84 | yes |
| g_2026_09_13_USM_WOL | WOL | 49 | 49 | yes |
| g_2026_09_13_AMB_CN2 | AMB | 52 | 52 | yes |
| g_2026_09_13_AMB_CN2 | CN2 | 85 | 85 | yes |
| g_2026_09_13_EDI_DRO | EDI | 49 | 49 | yes |
| g_2026_09_13_EDI_DRO | DRO | 85 | 85 | yes |
| g_2026_09_13_GTM_BLD | GTM | 78 | 78 | yes |
| g_2026_09_13_GTM_BLD | BLD | 47 | 43 | NO (needs manual items) |
| g_2026_09_20_ADM_AMB | ADM | 54 | 54 | yes |
| g_2026_09_20_ADM_AMB | AMB | 83 | 83 | yes |
| g_2026_09_20_WOL_GTM | WOL | 69 | 69 | yes |
| g_2026_09_20_WOL_GTM | GTM | 79 | 79 | yes |
| g_2026_09_27_GTM_USM | GTM | 81 | 81 | yes |
| g_2026_09_27_GTM_USM | USM | 58 | 58 | yes |
| g_2026_09_27_BLD_HAI | BLD | 55 | 55 | yes |
| g_2026_09_27_BLD_HAI | HAI | 59 | 59 | yes |
| g_2026_09_27_AMB_EDI | AMB | 69 | 58 | NO (needs manual items) |
| g_2026_09_27_AMB_EDI | EDI | 45 | 45 | yes |
| g_2026_09_27_CAS_ADM | CAS | 89 | 81 | NO (needs manual items) |
| g_2026_09_27_CAS_ADM | ADM | 50 | 50 | yes |
| g_2026_10_04_EDI_CAS | EDI | 57 | 57 | yes |
| g_2026_10_04_EDI_CAS | CAS | 76 | 74 | NO (needs manual items) |
| g_2026_10_04_GTM_COM | GTM | 80 | 80 | yes |
| g_2026_10_04_GTM_COM | COM | 65 | 65 | yes |
| g_2026_10_04_USM_DRO | USM | 63 | 63 | yes |
| g_2026_10_04_USM_DRO | DRO | 73 | 73 | yes |
| g_2026_10_04_BLD_AMB | BLD | 57 | 57 | yes |
| g_2026_10_04_BLD_AMB | AMB | 50 | 45 | NO (needs manual items) |
| g_2026_10_11_CAS_BLD | CAS | 91 | 91 | yes |
| g_2026_10_11_CAS_BLD | BLD | 61 | 30 | NO (needs manual items) |
| g_2026_10_11_AMB_WOL | AMB | 69 | 69 | yes |
| g_2026_10_11_AMB_WOL | WOL | 87 | 87 | yes |
| g_2026_10_11_GTM_DRO | GTM | 65 | 65 | yes |
| g_2026_10_11_GTM_DRO | DRO | 70 | 70 | yes |
| g_2026_10_18_GTM_HAI | GTM | 63 | 63 | yes |
| g_2026_10_18_GTM_HAI | HAI | 59 | 59 | yes |
| g_2026_10_18_CN2_EDI | CN2 | 88 | 88 | yes |
| g_2026_10_18_CN2_EDI | EDI | 54 | 54 | yes |
| g_2026_10_18_WOL_CAS | WOL | 74 | 74 | yes |
| g_2026_10_18_WOL_CAS | CAS | 90 | 90 | yes |

## 6. Files

- `repair-unambiguous.sql`: per-game transactions for games that fully reconcile after safe actions.
- `repair-partial-games.sql`: safe actions for games that also need manual decisions (reconciliation guard will fail until manual items are done).
- `audit-report.json`: complete machine-readable audit.
