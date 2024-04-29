import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

// Simpan nomor antrian dan status loket
let queueNumbers = {
  queue: 0,
  lokets: [
    { number: 0, status: "Menunggu" },
    { number: 0, status: "Menunggu" },
    { number: 0, status: "Menunggu" },
  ],
};

// Fungsi untuk mengambil nomor antrian baru dan menetapkan ke loket yang tersedia
const registerQueue = () => {
  const emptyLoketIndex = queueNumbers.lokets.findIndex(
    (loket) => loket.status === "Menunggu"
  );
  if (emptyLoketIndex !== -1) {
    // Jika ada loket kosong, tambahkan antrian baru ke loket tersebut
    queueNumbers.queue++;
    queueNumbers.lokets[emptyLoketIndex] = {
      number: queueNumbers.queue,
      status: "Serve",
      timestamp: Date.now(), // Set timestamp saat loket mulai melayani
    };
    updateQueue(); // Memperbarui antrian setelah menambahkan nomor baru
  } else {
    console.log("Semua loket sedang penuh");
  }
};

// Fungsi untuk menyelesaikan pelayanan pada loket
const finishService = (loketIndex) => {
  queueNumbers.lokets[loketIndex].status = "Success";
  console.log(`Loket ${loketIndex + 1} selesai dilayani`);
  // Reset nomor antrian pada loket yang selesai dilayani
  queueNumbers.lokets[loketIndex].number = 0;
};

// Fungsi untuk memperbarui status loket jika waktu melewati 5 detik
const updateLoketsStatus = () => {
  queueNumbers.lokets.forEach((loket, index) => {
    if (loket.status === "Serve") {
      const timeDiff = Date.now() - loket.timestamp;
      if (timeDiff >= 5000) {
        finishService(index);
        if (queueNumbers.queue > queueNumbers.lokets.length) {
          registerQueue(); // Panggil fungsi registerQueue jika masih ada antrian yang tersedia
        }
      }
    }
  });
};

// Fungsi untuk mengupdate klien dengan data antrian yang baru
const updateQueue = () => {
  io.emit("queueUpdated", queueNumbers); // Mengirimkan pembaruan antrian ke klien
};

// Meng-handle koneksi dari klien
io.on("connection", (socket) => {
  console.log("Client connected");

  // Mengirim data antrian ke klien saat koneksi berhasil
  socket.emit("queueUpdated", queueNumbers);

  // Meng-handle event 'registerQueue' dari klien
  socket.on("registerQueue", () => {
    registerQueue(); // Panggil fungsi registerQueue saat menerima event dari klien
  });

  // Meng-handle event ketika klien terputus
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Memulai interval untuk memeriksa dan memperbarui status loket setiap detik
setInterval(() => {
  updateLoketsStatus(); // Memeriksa status loket setiap detik
}, 1000);

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
