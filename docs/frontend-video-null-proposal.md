# Защита фронтенда для плана без видео

Изменение контракта video: object -> object | null уже разрешено владельцем. Для полного сценария нужны два точечных изменения компонентов; они ещё не внесены, поскольку фронтенд запрещён для редактирования.

В components/plan/exercise-card.tsx заменить только вызов плеера:

```tsx
{exercise.video && (
  <ExerciseVideo youtubeId={exercise.video.youtube_id} title={exercise.video.title} />
)}
```

В components/workout/exercise-logger.tsx обернуть существующий блок с кнопкой Watch technique и плеером условием:

```tsx
{exercise.video && (
  <div className="px-4 sm:px-5">
    <button
      type="button"
      onClick={() => setShowVideo((v) => !v)}
      aria-expanded={showVideo}
      className="-mt-1 mb-3 inline-flex h-9 items-center gap-1.5 rounded-sm text-sm font-medium text-lime"
    >
      {showVideo ? "Hide technique" : "Watch technique"}
    </button>
    {showVideo && (
      <div className="mb-4 max-w-xl">
        <ExerciseVideo youtubeId={exercise.video.youtube_id} title={exercise.video.title} />
      </div>
    )}
  </div>
)}
```

Кроме этих условий компоненты не меняются. Дополнительно требуется только .nullable() у video в lib/contract-draft/index.ts, чтобы серверный временный контракт принимал разрешённую владельцем форму; остальные расхождения контрактов не затрагиваются. Общий lib/contract/index.ts получит такое же nullable video в пределах уже разрешённых изменений контракта.
