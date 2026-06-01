# Resonance — Audio Spatial Processor

Минималистичный веб-инструмент для обработки аудио в реальном времени через Web Audio API. Создаёт эффекты приглушённого звука — как за стеной или в бочке.

![Resonance](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)

## Возможности

- **Два эффекта обработки:**
  - **Behind wall** — звук, приглушённый стеной (жёсткий lowpass + реверберация)
  - **In barrel** — звук внутри бочки (резонансный lowpass с модуляцией)
  - **Original** — без обработки
- **Загрузка аудио** — drag & drop или выбор файла (MP3, WAV, OGG, M4A)
- **Запись с микрофона** — захват звука прямо в браузере
- **Настройки в реальном времени** — все параметры применяются без перезагрузки
- **Визуализатор** — частотный анализатор на Canvas
- **Таймлайн** — перемотка с прогрессом
- **Экспорт** — рендеринг обработанного трека в WAV через OfflineAudioContext

## Управление

| Параметр | Описание | Диапазон |
|----------|----------|----------|
| Intensity | Сила эффекта | 0–100% |
| Cutoff | Частота среза фильтра | 50–2000 Hz |
| Reverb | Уровень реверберации | 0–100% |
| Muffle | Дополнительное приглушение (wall) | 0–100% |
| Volume | Громкость | 0–150% |

## Архитектура обработки звука

```
Source → Analyser → Lowpass → Highpass ─┬→ Dry → ─┐
                                          │         ├→ Gain → Compressor → Destination
                                          └→ Convolver → Wet → ┘
```

- **Lowpass** — срезает высокие частоты
- **Highpass** — убирает инфра-низ (для wall)
- **Convolver** — свёртка с синтетическим impulse response (для barrel/wall)
- **Compressor** — лимитер, защита от клиппинга

## Технологии

- **React 19** + **TypeScript**
- **Vite 7** — сборка
- **Tailwind CSS 4** — стили
- **Web Audio API** — обработка звука (AudioContext, OfflineAudioContext, BiquadFilter, Convolver)
- **MediaRecorder API** — запись с микрофона
- **Lucide React** — иконки

## Запуск

```bash
# Установка зависимостей
npm install

# Dev-сервер
npm run dev

# Сборка
npm run build

# Превью продакшен-сборки
npm run preview
```

После сборки готовый бандл лежит в `dist/index.html` — это single-file сборка, всё инлайнится.

## Структура проекта

```
src/
├── App.tsx                          # Главный компонент
├── main.tsx                         # Точка входа
├── index.css                        # Глобальные стили
├── components/
│   └── AudioVisualizer.tsx          # Canvas-визуализатор спектра
├── hooks/
│   └── useAudioProcessor.ts         # Логика Web Audio API
└── utils/
    └── audioEffects.ts              # Синтез impulse response и WAV-кодирование
```

## Особенности реализации

### Синтетические impulse response

Вместо использования готовых сэмплов реверберации, impulse response генерируется процедурно:

- **Barrel** — экспоненциальный decay с резонансными частотами 80/120/200 Hz
- **Wall** — быстрый decay с частотами 200/400 Hz (имитация отражения от стены)

### Offline рендеринг

Экспорт использует `OfflineAudioContext`, чтобы отрендерить весь обработанный файл за один проход и сохранить в WAV. AudioBuffer кодируется в 16-bit PCM через DataView.

### Real-time обновления

Все параметры (cutoff, intensity, mix) обновляются через `setTargetAtTime` с короткой сглаживающей константой (0.1s), чтобы избежать щелчков при изменении.

## Лицензия

MIT
