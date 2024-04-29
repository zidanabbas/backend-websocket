import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";

const PORT = 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(express.json());
app.use(cors());

const dirPath = "./data";
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath);
}

const queuesFilePath = "./data/queues.json";
if (!fs.existsSync(queuesFilePath)) {
  fs.writeFileSync(queuesFilePath, "[]", "utf-8");
}

// Fungsi untuk menyimpan data antrian ke dalam file
const saveQueuesToFile = () => {
  try {
    fs.writeFileSync(queuesFilePath, JSON.stringify(queues));
    console.log("Queues data saved to file.");
  } catch (err) {
    console.error("Error saving queues data to file:", err);
  }
};

// Fungsi untuk memuat data antrian dari file saat server dimulai
const loadQueuesFromFile = () => {
  try {
    const data = fs.readFileSync(queuesFilePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error loading queues data from file:", err);
    return [];
  }
};

// Inisialisasi antrian dari file saat server dimulai
let queues = loadQueuesFromFile();
const loketCount = 3;

// Config koneksi dari client
io.on("connection", (socket) => {
  console.log("a user connected");

  // Event ketika client memutuskan koneksi
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

// Event ketika ada permintaan untuk memanggil nomor antrian berikutnya
app.post("/call-next", (req, res) => {
  const nextQueueNumber = generateNextQueueNumber();
  if (nextQueueNumber) {
    io.emit("queue_update", { queueNumber: nextQueueNumber });
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: "No available queue." });
  }
});

// Event ketika ada permintaan untuk menyetujui nomor antrian yang sedang dilayani
app.post("/approve-queue", (req, res) => {
  const { queueNumber } = req.body;
  const servingQueue = queues.find(
    (queue) => queue.queueNumber === queueNumber
  );

  if (!servingQueue || servingQueue.status !== "serving") {
    res.status(404).json({
      success: false,
      message: "Invalid or not serving queue number.",
    });
    return;
  }

  // Ubah status antrian yang sedang dilayani menjadi "success"
  servingQueue.status = "success";

  // Kosongkan loket yang terkait dengan nomor antrian yang sedang dilayani
  servingQueue.counter = null;

  // Kirim pembaruan status antrian ke semua klien
  io.emit("queue_update", { queueNumber, newStatus: "success" });

  // Simpan perubahan data antrian ke dalam file
  saveQueuesToFile();

  res.json({ success: true });
});

// Route GET
app.get("/queue", (req, res) => {
  res.json(queues);
});

// Route POST untuk update antrian
app.post("/update-queue", (req, res) => {
  const updatedQueueData = req.body.updatedQueueData;
  if (!updatedQueueData || Object.keys(updatedQueueData).length === 0) {
    res.status(400).json({
      success: false,
      message: "Data antrian kosong atau tidak valid",
    });
  } else {
    queues = updatedQueueData;
    io.emit("queue_update", queues);
    res.json({ success: true });
  }
});

// Fungsi untuk menentukan loket berikutnya
const nextCounter = (currentCounter) => {
  let nextCounter = currentCounter + 1;
  if (nextCounter > loketCount) {
    nextCounter = 1;
  }
  return nextCounter;
};

// Fungsi untuk menghasilkan antrian berikutnya
const generateNextQueueNumber = () => {
  const nextQueue = queues.find((queue) => queue.status === "waiting");
  if (!nextQueue) {
    return null;
  }
  nextQueue.status = "being_served";
  saveQueuesToFile();
  return nextQueue.queueNumber;
};

httpServer.listen(PORT, () => {
  console.log(`listening on PORT ${PORT}`);
});
