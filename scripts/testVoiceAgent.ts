// Прямой тест voice-agent — без HTTP, без БД. Просто дёргает selectVoiceForCharacter.
// .env подтягивается через `node --env-file=.env`.
import { selectVoiceForCharacter } from '../server/voiceAgent.ts';

const character = {
  id: 'test_lily',
  name: 'Лили',
  personality: 'Робкая, нежная, мечтательная студентка-первокурсница. Любит читать стихи, краснеет от комплиментов, говорит тихо.',
  appearance:
    'Юная девушка лет 18, хрупкая, длинные светлые волосы до пояса, голубые глаза, бледная кожа, лёгкое летнее платье в цветочек.',
};

console.log('[test] starting voice agent for', character.name);
const start = Date.now();
const voiceId = await selectVoiceForCharacter(character);
const ms = Date.now() - start;
console.log(`\n[test] DONE in ${ms}ms`);
console.log(`[test] voice_id = ${voiceId}`);
if (voiceId === 'EXAVITQu4vr4xnSDxMaL') {
  console.log('[test] ⚠️  это FALLBACK Sarah — значит ElevenLabs library не отдала кандидатов');
} else {
  console.log('[test] ✅ агент выбрал реальный голос из библиотеки');
}
