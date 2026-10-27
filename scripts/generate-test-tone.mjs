import { writeFileSync } from 'node:fs';

const sampleRate = 44100;
const seconds = 2;
const samples = sampleRate * seconds;
const channels = 2;
const bytesPerSample = 2;
const dataBytes = samples * channels * bytesPerSample;
const out = Buffer.alloc(44 + dataBytes);
out.write('RIFF', 0);
out.writeUInt32LE(36 + dataBytes, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(channels, 22);
out.writeUInt32LE(sampleRate, 24);
out.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
out.writeUInt16LE(channels * bytesPerSample, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(dataBytes, 40);
for (let i = 0; i < samples; i++) {
  const value = Math.round(Math.sin((i / sampleRate) * Math.PI * 2 * 440) * 0.22 * 32767);
  out.writeInt16LE(value, 44 + i * 4);
  out.writeInt16LE(value, 46 + i * 4);
}
writeFileSync(new URL('../test-tone.wav', import.meta.url), out);
