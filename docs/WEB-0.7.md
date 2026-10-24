# Musical Detail Web Viewer 0.7

เพิ่ม YouTube reference เป็นค่าเริ่มต้น: สูตร ColorRotation จาก YouTube Musical Spectrum 20.0.2 (Muhammad Faiz), Saturation 20, Hue −3, HueRange 18, Brightness 10, Bass −30; peak rendering ใช้ PeakRange 72 และ PeakColor #6633cc เปิด–ปิดได้ ไม่ใช่ melody extraction

ความสว่างเป็นตัวคูณเชิงเส้น 0.00–3.00× ขั้นละ 0.01 ค่าเริ่มต้น 1.00× ปรับจากแถบเลื่อน คีย์ลูกศร หรือช่องตัวเลขได้ ไม่ใช่ dB และไม่เปลี่ยนเสียง playback การรับรู้ความสว่างยังขึ้นกับสูตรสีและจอ ค่าเกินขอบเขตสีอาจอิ่มตัว ไม่มี auto-normalization รายเฟรม

เก็บ raw CQT Float32 และ peak mask Uint8 แทนการบีบความเข้มก่อนเก็บ โหมด reference ข้าม soft compression/high-frequency darkening เดิม ชุดสี Magma/Inferno/Viridis/ขาวดำยังมี mapping เดิมให้เลือก แกน 960 bins / 60 fps / A4 440 Hz ไม่เปลี่ยน ไม่ snap pitch เปิดภาพครั้งแรก 10 วินาทีและปิดกริดโน้ตเพื่อลดการรบกวนสายตา

วิเคราะห์ในเครื่อง ไม่อัปโหลดเสียง เพิ่มข้อมูล peak หนึ่งไบต์ต่อ bin และปรับ memory guard แล้ว PNG ใช้ renderer/settings เดียวกับหน้าจอ การขยายไม่เพิ่มข้อมูลวิเคราะห์

ยังไม่อ้างว่าตรง YouTube ทุกพิกเซล: source/master, offset, sample rate, ขนาด canvas, การแทรกเฟรม และทิศเวลาอาจต่างกัน รอบนี้ไม่เพิ่ม fps ทั้งเพลงเพื่อหลีกเลี่ยงภาระหน่วยความจำ ต้องทำ same-source aligned comparison ก่อนตัดสินการเพิ่มรายละเอียด

สูตรที่ดัดแปลงอยู่ใน public/reference-color.mjs เผยแพร่ภายใต้ LGPL-3.0-or-later พร้อมประกาศผู้สร้างและการดัดแปลง ดู public/COPYING และ public/COPYING.LESSER; upstream: https://github.com/mfcc64/youtube-musical-spectrum

ทดสอบ: node tests/reference-color.mjs และ npm run test:pitch ใช้ YTMS_SOURCE ชี้ script.mjs ของต้นแบบเพื่อทดสอบ numeric parity ได้เพิ่มเติม

ผลตรวจ 24 ตุลาคม 2569: ตาราง ColorRotation ต่างจากต้นแบบสูงสุด 0; raw CQT และ mapping เดิมผ่าน 600 pure-tone cases; worker ส่งข้อมูล G4/G#4/A4 ถูกต้อง; production build วิเคราะห์ Rosanna MP3 5:29 จบ เปิดภาพและเล่น/หยุดด้วย Space ได้ ปรับ 1.25→1.26 ด้วยลูกศร สลับ reference/Magma และ peak on/off ซูมเวลา และคัดลอก PNG 1359×1286 สำเร็จ ไม่พบ console error ใน in-app browser การทดสอบนี้ยังไม่ใช่ same-source pixel comparison กับ YouTube
