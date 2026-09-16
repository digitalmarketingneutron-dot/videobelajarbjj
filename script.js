const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwg0JXaoE8aj1LUm-aNReGH83ayPP3uKjAhVXAhI4XY_ZkiX8rkPv-QRNPrxvpA5Gnk/exec';

        let studentVideos = [];
        let currentStudent = null;
        let globalDatabase = null;
        let currentActiveItemUrl = "";
        let realTimeSync = null;

        /* UTILITIES */
        function showLoading(text = "Memproses...") {
            let t = document.getElementById('loadingText');
            let o = document.getElementById('loadingOverlay');
            if(t) t.innerText = text;
            if(o) o.style.display = 'flex';
        }

        function hideLoading() { 
            let o = document.getElementById('loadingOverlay');
            if(o) o.style.display = 'none'; 
        }

        function togglePasswordVisibility() {
            let passInput = document.getElementById('passInput');
            if(passInput) passInput.type = passInput.type === "password" ? "text" : "password";
        }

        /* FITUR SWITCH PAGE / TAB NAVIGASI */
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

            let targetTab = document.getElementById(tabId);
            if(targetTab) targetTab.classList.add('active');

            let activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
            if(activeNav) activeNav.classList.add('active');

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        /* FULLSCREEN VIDEO */
        function toggleFullscreen() {
            let elem = document.getElementById('mediaBox');
            if (!document.fullscreenElement) {
                if (elem && elem.requestFullscreen) elem.requestFullscreen();
                else if (elem && elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
                if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{});
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
            }
        }

        window.addEventListener('DOMContentLoaded', async () => {
            let splash = document.getElementById('splashScreen');
            setTimeout(() => {
                if(splash) {
                    splash.style.opacity = '0';
                    splash.style.visibility = 'hidden';
                }
            }, 800);

            let savedUser = localStorage.getItem('elearn_logged_user');
            let savedToken = localStorage.getItem('elearn_session_token');
            
            if (savedUser && savedToken) {
                showLoading("Memuat sesi akun...");
                try {
                    let response = await fetch(SCRIPT_URL);
                    let data = await response.json();
                    globalDatabase = data;

                    let student = data.siswa ? data.siswa.find(s => s.username === savedUser) : null;
                    if (student) {
                        if (student.isLocked) {
                            localStorage.removeItem('elearn_logged_user');
                            hideLoading(); 
                            let loginSec = document.getElementById('loginSection');
                            if(loginSec) loginSec.style.display = 'block';
                            return;
                        }
                        if (student.token && student.token !== "" && student.token !== savedToken) {
                            alert("Sesi berakhir karena akun ini telah login di perangkat lain.");
                            handleLogout(false); 
                            hideLoading(); 
                            let loginSec = document.getElementById('loginSection');
                            if(loginSec) loginSec.style.display = 'block';
                            return;
                        }
                        setupDashboard(student, data);
                    } else {
                        handleLogout(false); 
                        let loginSec = document.getElementById('loginSection');
                        if(loginSec) loginSec.style.display = 'block';
                    }
                } catch (error) {
                    let loginSec = document.getElementById('loginSection');
                    if(loginSec) loginSec.style.display = 'block';
                } finally {
                    hideLoading();
                }
            } else {
                let loginSec = document.getElementById('loginSection');
                if(loginSec) loginSec.style.display = 'block';
            }
        });

        /* REALTIME SYNC */
        function startRealTimeSync() {
            if (realTimeSync) clearInterval(realTimeSync);
            realTimeSync = setInterval(async () => {
                if (!currentStudent) return;
                try {
                    let response = await fetch(SCRIPT_URL);
                    let data = await response.json();
                    globalDatabase = data;

                    let me = data.siswa ? data.siswa.find(s => s.username === currentStudent.username) : null;
                    let myToken = localStorage.getItem('elearn_session_token');
                    if (me && me.token && me.token !== "" && me.token !== myToken) {
                        alert("SESI BERAKHIR: Akun Anda terdeteksi login di perangkat lain!");
                        handleLogout(false); 
                        return;
                    }

                    if (currentActiveItemUrl !== "" && data.video) {
                        let updatedVid = data.video.find(v => v.url === currentActiveItemUrl);
                        if (updatedVid) {
                            let likeCountEl = document.getElementById('likeCount');
                            if(likeCountEl) likeCountEl.innerText = updatedVid.likes || 0;
                            renderStudentHistory(updatedVid);
                        }
                    }
                } catch(e) {}
            }, 12000);
        }

        async function handleLogin() {
            let userInputEl = document.getElementById('userInput');
            let passInputEl = document.getElementById('passInput');
            let errDiv = document.getElementById('errorMsg');

            let user = userInputEl ? userInputEl.value.trim() : '';
            let pass = passInputEl ? passInputEl.value.trim() : '';

            if(!user || !pass) { if(errDiv) errDiv.innerText = "Username dan password wajib diisi!"; return; }
            if(errDiv) errDiv.innerText = "";
            showLoading("Menghubungkan ke server...");

            let maxRetries = 3;
            let attempt = 0;
            let success = false;
            let data = null;

            while (attempt < maxRetries && !success) {
                try {
                    attempt++;
                    if (attempt > 1) showLoading(`Mencoba ulang koneksi (${attempt}/${maxRetries})...`);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    let response = await fetch(SCRIPT_URL, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    data = await response.json();
                    globalDatabase = data;
                    success = true;
                } catch (error) {
                    if (attempt >= maxRetries) {
                        hideLoading(); if(errDiv) errDiv.innerText = "Gagal terhubung ke server. Silakan Coba lagi."; return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }

            try {
                let student = data.siswa ? data.siswa.find(s => s.username === user && s.password === pass) : null;
                if(student) {
                    if (student.isLocked) { hideLoading(); if(errDiv) errDiv.innerText = "Akun Anda terkunci."; return; }

                    let newSessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
                    localStorage.setItem('elearn_logged_user', student.username);
                    localStorage.setItem('elearn_session_token', newSessionToken);
                    
                    fetch(SCRIPT_URL, {
                        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: "update_session", username: student.username, token: newSessionToken })
                    });

                    setupDashboard(student, data);
                } else {
                    if(errDiv) errDiv.innerText = "Username atau Password salah!";
                }
            } catch (e) { 
                if(errDiv) errDiv.innerText = "Terjadi kesalahan sistem saat memproses data."; 
            } finally { 
                hideLoading(); 
            }
        }

        function setupDashboard(student, data) {
            currentStudent = student;
            let loginSec = document.getElementById('loginSection');
            let dashSec = document.getElementById('dashboardSection');
            let welcomeEl = document.getElementById('welcomeText');
            let classEl = document.getElementById('classText');

            if(loginSec) loginSec.style.display = 'none';
            if(dashSec) dashSec.style.display = 'block';
            if(welcomeEl) welcomeEl.innerText = "Selamat datang, " + student.nama;
            if(classEl) classEl.innerText = "Kelas: " + (student.kelas || "-");
            
            let kelompokElem = document.getElementById('kelompokText');
            if (kelompokElem) {
                kelompokElem.innerText = "Kelompok: " + (student.kelompokKelas ? student.kelompokKelas.join(', ') : "-");
            }

            studentVideos = (data && data.video) ? data.video.filter(v => student.kelompokKelas && student.kelompokKelas.includes(v.kelompokKelas)) : [];
            
            renderTreePlaylist();
            renderAkademik(student);
            renderInformasi(data);
            renderNotifikasi(student);
            
            switchTab('home');
            startRealTimeSync(); 
        }

        /* --- PERBAIKAN RENDER AKADEMIK (NILAI & ABSENSI) --- */
        function renderAkademik(student) {
            let absenContainer = document.getElementById('absensiContainer');
            if (!absenContainer) return;

            // Ambil data absensi dari globalDatabase berdasarkan username, atau gunakan default
            let absen = (globalDatabase && globalDatabase.absensi) ? globalDatabase.absensi.find(a => a.username === student.username) : null;
            absen = absen || student.absensi || { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
            
            absenContainer.innerHTML = `
                <div class="stat-card"><div class="stat-val val-hadir">${absen.hadir || 0}</div><div class="stat-label">Hadir</div></div>
                <div class="stat-card"><div class="stat-val val-izin">${absen.izin || 0}</div><div class="stat-label">Izin</div></div>
                <div class="stat-card"><div class="stat-val val-sakit">${absen.sakit || 0}</div><div class="stat-label">Sakit</div></div>
                <div class="stat-card"><div class="stat-val val-alpa">${absen.alpa || 0}</div><div class="stat-label">Alpa</div></div>
            `;

            let nilaiContainer = document.getElementById('nilaiContainer');
            if (!nilaiContainer) return;

            // Ambil data nilai dari globalDatabase berdasarkan username, atau dari objek student
            let nilai = (globalDatabase && globalDatabase.nilai) ? globalDatabase.nilai.filter(n => n.username === student.username) : [];
            if (nilai.length === 0 && student.nilai) nilai = student.nilai;

            if (!nilai || nilai.length === 0) {
                nilaiContainer.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 20px; font-weight: 700;">Belum ada rekap nilai tersedia.</td></tr>`;
                return;
            }

            let htmlNilai = '';
            nilai.forEach(n => {
                let tugas = parseFloat(n.tugas) || 0;
                let uts = parseFloat(n.uts) || 0;
                let uas = parseFloat(n.uas) || 0;
                let rataRata = Math.round((tugas + uts + uas) / 3);
                
                let gradeClass = 'grade-d'; 
                let status = 'Kurang';
                if(rataRata >= 85) { gradeClass = 'grade-a'; status = 'Sangat Baik'; }
                else if(rataRata >= 75) { gradeClass = 'grade-b'; status = 'Baik'; }
                else if(rataRata >= 60) { gradeClass = 'grade-c'; status = 'Cukup'; }

                htmlNilai += `
                    <tr>
                        <td class="subject">${n.mapel || '-'}</td>
                        <td>${tugas}</td>
                        <td>${uts}</td>
                        <td>${uas}</td>
                        <td><strong>${rataRata}</strong></td>
                        <td><span class="grade-badge ${gradeClass}">${status}</span></td>
                    </tr>
                `;
            });
            nilaiContainer.innerHTML = htmlNilai;
        }

        /* --- RENDER INFORMASI --- */
        function renderInformasi(data) {
            let infoContainer = document.getElementById('informasiContainer');
            if (!infoContainer) return;

            let info = (data && data.informasi) ? data.informasi : [];
            if (info.length === 0) {
                infoContainer.innerHTML = `<div class='no-history'>Belum ada pengumuman terbaru.</div>`;
                return;
            }

            let htmlInfo = '';
            info.forEach(i => {
                let urgentClass = i.isUrgent ? 'urgent' : '';
                htmlInfo += `
                    <div class="info-card ${urgentClass}">
                        <div class="info-header">
                            <span class="info-date">${i.tanggal || ''}</span>
                        </div>
                        <div class="info-title">${i.judul || ''}</div>
                        <div class="info-body">${i.isi || ''}</div>
                    </div>
                `;
            });
            infoContainer.innerHTML = htmlInfo;
        }

        /* --- RENDER NOTIFIKASI --- */
        function renderNotifikasi(student) {
            let notif = (globalDatabase && globalDatabase.notifikasi) ? globalDatabase.notifikasi.filter(n => n.username === student.username) : [];

            let htmlNotif = '';
            let unreadCount = 0;

            notif.forEach(n => {
                if(!n.isRead) unreadCount++;
                htmlNotif += `
                    <div class="notif-item ${n.isRead ? '' : 'unread'}">
                        <div class="notif-time">${n.waktu || ''}</div>
                        <div class="notif-text">${n.pesan || ''}</div>
                    </div>
                `;
            });

            if(notif.length === 0) {
                htmlNotif = '<div class="notif-empty">Belum ada notifikasi untuk Anda.</div>';
            }

            let notifListEl = document.getElementById('notifList');
            if(notifListEl) notifListEl.innerHTML = htmlNotif;
            
            let badge = document.getElementById('notifBadge');
            if(badge) {
                if(unreadCount > 0) {
                    badge.style.display = 'block';
                    badge.innerText = unreadCount;
                } else {
                    badge.style.display = 'none';
                }
            }
        }

        function renderTreePlaylist() {
            let container = document.getElementById('playlistContainer');
            if (!container) return;
            container.innerHTML = "";
            
            let counterEl = document.getElementById('playlistCounter');
            if(counterEl) counterEl.innerText = studentVideos.length + " Materi";

            if(studentVideos.length === 0) {
                container.innerHTML = `<div class='no-history'>Belum ada materi tersedia.</div>`;
                let mediaPlayer = document.getElementById('mediaPlayer');
                let pdfPlayer = document.getElementById('pdfPlayer');
                let pdfSec = document.getElementById('pdfContainerSection');
                let pdfNotice = document.getElementById('pdfEmptyNotice');
                
                if(mediaPlayer) mediaPlayer.src = ""; 
                if(pdfPlayer) pdfPlayer.src = "";
                if(pdfSec) pdfSec.style.display = 'none';
                if(pdfNotice) pdfNotice.style.display = 'block';
                currentActiveItemUrl = ""; return;
            }

            let groupedMapel = {};
            studentVideos.forEach(v => {
                if(!groupedMapel[v.mapel]) groupedMapel[v.mapel] = [];
                groupedMapel[v.mapel].push(v);
            });

            let activeVid = studentVideos.find(v => v.url === currentActiveItemUrl);
            let currentActiveMapel = activeVid ? activeVid.mapel : studentVideos[0].mapel;

            Object.keys(groupedMapel).forEach((mapelName) => {
                let itemsInMapel = groupedMapel[mapelName];
                let isCurrentFolder = (mapelName === currentActiveMapel);
                let folder = document.createElement('div'); folder.className = "folder-root";

                let folderHeader = document.createElement('div');
                folderHeader.className = "folder-header" + (isCurrentFolder ? " open" : "");
                folderHeader.innerHTML = `<div class="folder-title"><span class="folder-icon">▶</span><span>📁 ${mapelName}</span></div><span class="folder-count">${itemsInMapel.length} Materi</span>`;

                let folderItems = document.createElement('div');
                folderItems.className = "folder-items";
                folderItems.style.display = isCurrentFolder ? "flex" : "none";

                itemsInMapel.forEach((vid, index) => {
                    let fileId = extractDriveId(vid.url);
                    let itemKey = "viewed_" + currentStudent.username + "_" + fileId;
                    let isViewed = localStorage.getItem(itemKey) === "true";
                    let item = document.createElement('div');
                    item.className = "playlist-item " + (vid.url === currentActiveItemUrl ? "active" : "");
                    let iconSymbol = vid.url === currentActiveItemUrl ? "▶" : (index + 1);

                    item.innerHTML = `<div class="playlist-thumb">${iconSymbol}</div><div class="playlist-info"><div class="playlist-title">${vid.judul}</div><div class="playlist-status ${isViewed ? 'watched' : ''}">${isViewed ? '✓ Selesai' : 'Belum dibuka'}</div></div>`;

                    item.onclick = (e) => { e.stopPropagation(); loadSelectedMediaData(vid.url); renderTreePlaylist(); };
                    folderItems.appendChild(item);
                });

                folderHeader.onclick = () => {
                    let isOpen = folderItems.style.display === "flex";
                    folderItems.style.display = isOpen ? "none" : "flex";
                    folderHeader.classList.toggle("open", !isOpen);
                };

                folder.appendChild(folderHeader); folder.appendChild(folderItems); container.appendChild(folder);
            });

            if (!currentActiveItemUrl && studentVideos.length > 0) loadSelectedMediaData(studentVideos[0].url);
        }

        function loadSelectedMediaData(url) {
            currentActiveItemUrl = url;
            let vid = studentVideos.find(v => v.url === url);
            if(!vid) return;

            let videoFileId = extractDriveId(vid.url);
            let mediaPlayer = document.getElementById('mediaPlayer');
            let likeCountEl = document.getElementById('likeCount');

            if(mediaPlayer) mediaPlayer.src = "https://drive.google.com/file/d/" + videoFileId + "/preview";
            if(likeCountEl) likeCountEl.innerText = vid.likes || 0;

            let pdfSec = document.getElementById('pdfContainerSection');
            let pdfNotice = document.getElementById('pdfEmptyNotice');
            let pdfPlayer = document.getElementById('pdfPlayer');

            if (vid.pdfUrl && vid.pdfUrl.trim() !== "") {
                let pdfFileId = extractDriveId(vid.pdfUrl);
                if(pdfPlayer) pdfPlayer.src = "https://drive.google.com/file/d/" + pdfFileId + "/preview?usp=drivesdk";
                if(pdfSec) pdfSec.style.display = 'block'; 
                if(pdfNotice) pdfNotice.style.display = 'none';
            } else {
                if(pdfPlayer) pdfPlayer.src = ""; 
                if(pdfSec) pdfSec.style.display = 'none'; 
                if(pdfNotice) pdfNotice.style.display = 'block';
            }

            let itemKey = "viewed_" + currentStudent.username + "_" + videoFileId;
            localStorage.setItem(itemKey, "true");
            updateWatchStatus(true);
            renderLikeStatus(vid);
            renderStudentHistory(vid);
        }

        function extractDriveId(url) {
            if (!url) return "";
            let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
            return match && match[1] ? match[1] : url.trim();
        }

        function renderLikeStatus(vid) {
            let fileId = extractDriveId(vid.url);
            let likedKey = "liked_" + currentStudent.username + "_" + fileId;
            let isLiked = localStorage.getItem(likedKey) === "true";
            let likeBtn = document.getElementById('likeBtn');
            if (likeBtn) {
                if (isLiked) likeBtn.classList.add('liked'); else likeBtn.classList.remove('liked');
            }
        }

        async function toggleLike() {
            if (!currentActiveItemUrl) return;
            let vid = studentVideos.find(v => v.url === currentActiveItemUrl);
            if(!vid) return;

            let fileId = extractDriveId(vid.url);
            let likedKey = "liked_" + currentStudent.username + "_" + fileId;
            let isLiked = localStorage.getItem(likedKey) === "true";
            let isAdd = !isLiked;
            
            localStorage.setItem(likedKey, isAdd ? "true" : "false");
            let currentLikes = parseInt(vid.likes) || 0;
            vid.likes = isAdd ? currentLikes + 1 : Math.max(0, currentLikes - 1);
            
            let likeCountEl = document.getElementById('likeCount');
            if(likeCountEl) likeCountEl.innerText = vid.likes;
            renderLikeStatus(vid);

            try {
                let payload = { action: "like", judul: vid.judul, isAdd: isAdd };
                await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            } catch (error) { console.error("Gagal memperbarui like."); }
        }

        function renderStudentHistory(currentVideo) {
            let historyList = document.getElementById('historyList');
            if(!historyList) return;
            historyList.innerHTML = "";

            if (!globalDatabase || !globalDatabase.komentar) {
                historyList.innerHTML = "<div class='no-history'>Belum ada riwayat pertanyaan.</div>"; return;
            }

            let myComments = globalDatabase.komentar.filter(k => k.namaSiswa && k.judulVideo && k.namaSiswa.toLowerCase().trim() === currentStudent.nama.toLowerCase().trim() && k.judulVideo.trim() === currentVideo.judul.trim());

            if (myComments.length === 0) {
                historyList.innerHTML = "<div class='no-history'>Belum ada riwayat pertanyaan untuk materi ini.</div>"; return;
            }

            myComments.forEach(item => {
                let card = document.createElement('div'); card.className = "history-card";
                let html = `<div class="time">Waktu: ${item.waktu}</div><div class="question"><strong>Anda:</strong> ${item.pesan}</div>`;
                if (item.respon && item.respon.trim() !== "") html += `<div class="reply"><strong>Respon Pengajar:</strong> ${item.respon}</div>`;
                else html += `<div class="pending-reply">Menunggu respon dari pengajar...</div>`;
                card.innerHTML = html; historyList.appendChild(card);
            });
        }

        function updateWatchStatus(watched) {
            let badge = document.getElementById('watchStatusBadge');
            if(badge) {
                badge.className = watched ? "status-badge watched" : "status-badge";
                badge.innerHTML = watched ? `Status: Selesai Ditonton` : `Status: Belum Ditonton`;
            }
        }

        async function sendCommentToSheet() {
            let input = document.getElementById('commentInput');
            if(!input) return;
            let pesan = input.value.trim();
            if(!pesan) { alert("Pertanyaan tidak boleh kosong!"); return; }
            if (!currentActiveItemUrl) return;
            let currentVideo = studentVideos.find(v => v.url === currentActiveItemUrl);
            if(!currentVideo) return;

            let submitBtn = document.getElementById('commentSubmitBtn');
            let loadingInd = document.getElementById('commentLoading');
            if(submitBtn) submitBtn.style.display = 'none'; 
            if(loadingInd) loadingInd.style.display = 'flex'; 
            input.disabled = true;

            try {
                let payload = { action: "comment", nama: currentStudent.nama, judulVideo: currentVideo.judul, pesan: pesan };
                await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                input.value = "";
                
                setTimeout(async () => {
                    let response = await fetch(SCRIPT_URL);
                    globalDatabase = await response.json();
                    renderStudentHistory(currentVideo);
                    if(submitBtn) submitBtn.style.display = 'block'; 
                    if(loadingInd) loadingInd.style.display = 'none'; 
                    input.disabled = false;
                }, 1500);
            } catch (error) {
                alert("Gagal mengirim pertanyaan. Silakan coba lagi.");
                if(submitBtn) submitBtn.style.display = 'block'; 
                if(loadingInd) loadingInd.style.display = 'none'; 
                input.disabled = false;
            }
        }

        // Jam Real-Time
        setInterval(() => {
            let now = new Date();
            let options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            
            let elTanggal = document.getElementById('tanggalHariIni');
            let elJam = document.getElementById('jamRealTime');
            
            if(elTanggal && elJam) {
                elTanggal.innerText = now.toLocaleDateString('id-ID', options);
                elJam.innerText = now.toLocaleTimeString('id-ID') + " WIB";
            }
        }, 1000);

        function handleLogout(clearServerToken = true) {
            if (realTimeSync) clearInterval(realTimeSync);
            if (clearServerToken && currentStudent) {
                fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: "update_session", username: currentStudent.username, token: "" }) });
            }
            localStorage.removeItem('elearn_logged_user'); localStorage.removeItem('elearn_session_token');
            currentStudent = null; globalDatabase = null; currentActiveItemUrl = "";
            
            let dashSec = document.getElementById('dashboardSection');
            let loginSec = document.getElementById('loginSection');
            let userInputEl = document.getElementById('userInput');
            let passInputEl = document.getElementById('passInput');

            if(dashSec) dashSec.style.display = 'none';
            if(loginSec) loginSec.style.display = 'block';
            if(userInputEl) userInputEl.value = ''; 
            if(passInputEl) passInputEl.value = '';
            
            let media = document.getElementById('mediaPlayer');
            let pdf = document.getElementById('pdfPlayer');
            if(media) media.src = '';
            if(pdf) pdf.src = '';
            
            switchTab('home');
        }

        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => { if (e.key === 'F12' || (e.ctrlKey && ['u', 's', 'i', 'j'].includes(e.key.toLowerCase()))) e.preventDefault(); });
