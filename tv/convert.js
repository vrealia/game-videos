import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Папки для входных и выходных файлов
const inputDir = path.join(process.cwd(), 'input');
const outputDir = path.join(process.cwd(), 'output');

// Интервал обрезки сегментов (в секундах)
const sec = 2;
const maxConcurrentProcesses = 5;

// Проверяем, существует ли выходная директория, если нет — создаем
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Функция для сегментации видео
const processVideo = (filePath, filename) => {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(outputDir, `${filename}.m3u8`);
    const segmentFilePattern = path.join(outputDir, `${filename}_segment%03d.ts`);
    
    const ffmpegArgs = [
      '-y',              // Перезаписать выходной файл без запроса
      '-threads', 'auto',// Автоматическое определение количества потоков
      '-i', filePath,    // Входной файл
      '-f', 'hls',       // Формат HLS
      '-hls_time', sec,  // Время для каждого сегмента
      '-hls_list_size', '0',  // Список сегментов (без ограничения)
      '-hls_segment_filename', segmentFilePattern, // Шаблон для сегментов
      outputFile         // Выходной файл .m3u8
    ];

    // Запуск ffmpeg как процесс
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'ignore', 'pipe'] // Перенаправляем stdout и stderr в null
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Обработка завершена для файла ${filename}`);
        resolve(); // Завершаем промис при успешном завершении процесса
      } else {
        console.error(`Процесс завершился с кодом ${code} для файла ${filename}`);
        reject(new Error(`Ошибка при обработке файла ${filename}`)); // Ожидаем ошибку при завершении с ненулевым кодом
      }
    });
  });
};

const inputFiles = fs.readdirSync(inputDir)
  .filter(file => file.endsWith('.webm'))

const processFilesConcurrently = async () => {
  const groupsAmount = Math.ceil(inputFiles.length / maxConcurrentProcesses)

  for (let group = 0; group < groupsAmount; group += 1) {
    const shift = group * maxConcurrentProcesses;
    const groupFiles = inputFiles.slice(shift, shift+maxConcurrentProcesses)
    
    console.log(`Обрабатываем ${group+1} группу из ${groupsAmount}`)

    await Promise.all(groupFiles.map(file => {
      const filePath = path.join(inputDir, file);
      const filename = path.basename(file, '.webm');
  
      console.log(`Обрабатываем файл: ${filePath}`);
  
      return processVideo(filePath, filename)
    }))
  }

  console.log('Все файлы обработаны.');
};

processFilesConcurrently().catch((error) => {
  console.error('Ошибка при обработке файлов:', error);
});