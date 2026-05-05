# Sara — AI Receptionist Feature Log

Sara is a Vapi-powered AI voice receptionist for PowerFit Gym. This document tracks all active features and upcoming improvements.

---

## Active Features

### Core Behaviour
| Feature | Details |
|---|---|
| **System Prompt** | Full personality, rules, class schedule, pricing, gym hours, and guardrails baked in |
| **First Message** | Custom warm opener: *"Hey there! Thanks for calling PowerFit, this is Sara — what can I help you with today?"* |
| **End Call Message** | *"Thanks so much for calling PowerFit! Have an amazing day!"* |
| **End Call Phrases** | Auto-hangs up on: `goodbye`, `bye`, `thank you bye`, `that's all` |
| **Max Call Duration** | Hard 5-minute (300s) limit — prevents runaway calls |

### AI Brain
| Feature | Details |
|---|---|
| **LLM Model** | OpenRouter → `gpt-4o-mini` (configurable via `OPENROUTER_MODEL` env var) |
| **Temperature** | `0.5` — balanced between natural and predictable responses |
| **Filler Injection** | Sara says *"um"*, *"let me check that..."* while thinking — feels human |

### Voice
| Feature | Details |
|---|---|
| **TTS Provider** | ElevenLabs — natural, expressive voice |
| **Voice Settings** | Stability `0.5`, Similarity Boost `0.75` — warm and consistent |
| **Backchanneling** | Sara says *"mhm"*, *"got it"*, *"sure"*, *"I see"* while caller is still speaking |

### Tools (Functions Sara Can Call)
| Tool | What it does |
|---|---|
| `bookClass` | Books a fitness class — writes to Supabase `bookings` table |
| `saveLead` | Saves a new lead — writes to Supabase `members` table |
| `getMemberInfo` | Looks up an existing member by phone number |

### Infrastructure
| Feature | Details |
|---|---|
| **Webhook Handler** | `/api/vapi-webhook` — handles `call.started`, `call.ended`, `tool.called`, `call.missed` |
| **Call Recording** | Full audio recorded for every call — playable in the dashboard |
| **Credential Management** | ElevenLabs and OpenRouter API keys registered inside Vapi automatically |
| **Upsert (PATCH)** | Sara is updated not recreated on each sync — keeps her Vapi ID stable |
| **Phone Number Linking** | Twilio number auto-relinked to Sara's ID after every sync |
| **BYOC (Twilio)** | Bring Your Own Carrier — you own the phone number, Vapi routes calls through it |

### Guardrails
| Feature | Details |
|---|---|
| **Topic Restriction** | Sara refuses off-topic questions politely |
| **Prompt Injection Protection** | Ignores attempts to change her instructions mid-call |
| **Abuse Handling** | Warns once, then ends the call politely |
| **No Hallucination** | Only references classes, prices, and timings explicitly listed in the prompt |
| **PII Protection** | Never asks for payment cards or passwords |

---

## Upcoming Features

### High Priority — Call Quality
| Feature | What it adds |
|---|---|
| **STT Provider (Deepgram)** | More accurate speech-to-text — especially for names and gym terms like *CrossFit*, *HIIT*, *Pilates* |
| **Custom Vocabulary / Keywords** | Teach the STT to correctly recognise gym-specific words it might mishear |
| **Smart Endpointing** | Smarter detection of when the caller has finished speaking — stops Sara from cutting in too early |
| **Response Delay Tuning** | Small natural pause before Sara replies — removes the instant-response robotic feel |

### High Priority — Analytics
| Feature | What it adds |
|---|---|
| **Call Summary (analysisPlan)** | Auto-generates a structured plain-English summary of every call after it ends |
| **Success Evaluation** | Automatically scores each call — did Sara actually book something or capture a lead? |
| **Structured Data Extraction** | Pulls key fields (name, class, phone, interest) from the transcript automatically after the call |

### Medium Priority — Caller Experience
| Feature | What it adds |
|---|---|
| **Background Sound** | Subtle gym/office ambiance — makes it feel like a real reception desk |
| **Voicemail Detection** | If the call goes to voicemail, Sara leaves a short message instead of going silent |
| **Idle Timeout Message** | If the caller goes quiet, Sara prompts: *"Hey, still there?"* |
| **Emotion Recognition** | Detects if the caller sounds frustrated or nervous — Sara adjusts her tone accordingly |

### Medium Priority — Operational
| Feature | What it adds |
|---|---|
| **Call Transfer** | Escalates to a real human staff member if the caller explicitly asks or Sara cannot help |
| **Outbound Calling** | Sara proactively calls leads or sends booking reminders |
| **SMS Follow-up** | Sends a confirmation SMS after a booking is made |
| **Multi-language Support** | Sara can switch to Urdu or another language if the caller prefers |

### Low Priority — Nice to Have
| Feature | What it adds |
|---|---|
| **Video Recording** | Record video alongside audio (currently disabled) |
| **Webhook Retry Logic** | Automatically retries failed webhook deliveries |
| **Rate Limiting on Tools** | Prevents Sara from calling the same tool multiple times in one turn |
| **A/B Testing Prompts** | Test two versions of Sara's personality and compare booking conversion rates |

---

## Changelog

| Date | Change |
|---|---|
| 2026-05-06 | Added backchanneling (`mhm`, `got it`, `sure`) and filler injection (`um`, processing sounds) |
| 2026-05-03 | Upsert assistant via PATCH to keep stable ID, auto-relink phone number after sync |
| 2026-05-03 | Updated Sara system prompt — warmer personality, natural conversational booking flow |
| 2026-05-03 | Fixed classTime DB insert, improved conversation flow |
| 2026-05-03 | Added PATCH endpoint to link Twilio number to assistant, added Sync button to Settings UI |
| 2026-05-03 | Moved tools inside model block — Vapi rejects root-level tools property |
| 2026-05-02 | Integrated Twilio phone calling via Vapi BYOC |
| 2026-05-02 | Added AI guardrails — topic restriction, prompt injection, abuse handling, PII protection |
| 2026-05-02 | Full call log with structured chat transcript and audio recording playback |
