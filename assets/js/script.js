document.addEventListener('DOMContentLoaded', () => {
    // ... (deklarasi variabel elemen HTML sama seperti sebelumnya) ...
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const summaryCountElement = document.getElementById('summary-count');
    const provinceListContainer = document.getElementById('province-list');
    const searchInput = document.getElementById('search-input');
    const loadingMessage = document.querySelector('.loading-message'); // Ambil loading msg dari sini

    const dataUrl = 'data/penduduk.json';
    let allProvincesData = [];

    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) { return '0'; }
        return num.toLocaleString('id-ID');
    }

    async function fetchDataAndRender() {
        // Hapus pesan loading lama jika ada
        if(loadingMessage) loadingMessage.textContent = "Memproses data provinsi...";

        try {
            const response = await fetch(dataUrl);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const rawData = await response.json();

            

            
            const latestEntries = {};
            rawData.forEach(item => {
                const kabkot = (item.kabkot || "Unknown").trim();
                const year = parseInt(item.tahun) || 0;
                // Pastikan item.prov ada sebelum mengaksesnya
                const provinceKey = item.prov || "Unknown";
                // Gunakan kombinasi kabkot dan prov sebagai kunci unik sementara
                // untuk memastikan kita tidak salah menggabungkan kabkot dengan nama sama di provinsi berbeda
                const uniqueKey = `${provinceKey}_${kabkot}`;

                if (!latestEntries[uniqueKey] || year > latestEntries[uniqueKey].tahun) {
                    latestEntries[uniqueKey] = { ...item, tahun: year };
                }
            });
            const latestData = Object.values(latestEntries);

            // Langkah 2: Proses data terbaru (sama seperti sebelumnya)
            const provinces = {};
            let totalPopulation = 0;
            let minYear = Infinity;
            let maxYear = -Infinity;
            const totalKabkot = latestData.length;

            latestData.forEach(item => {
                const population = parseInt(item.penduduk) || 0;
                totalPopulation += population;
                const year = item.tahun;
                 if (year > 0) {
                    minYear = Math.min(minYear, year);
                    maxYear = Math.max(maxYear, year);
                 }
                const provinceName = item.prov; // Nama provinsi sudah dibersihkan
                if (!provinces[provinceName]) {
                    provinces[provinceName] = { totalPenduduk: 0, cities: [] };
                }
                provinces[provinceName].totalPenduduk += population;
                provinces[provinceName].cities.push({
                    name: item.kabkot,
                    population: population,
                    year: year
                });
            });

             if (minYear === Infinity) minYear = "N/A";
             if (maxYear === -Infinity) maxYear = "N/A";
             const totalProvinces = Object.keys(provinces).length;

            // Langkah 3: Update Judul Halaman (sama)
            titleLine1Element.textContent = `Data Penduduk Indonesia (${minYear} - ${maxYear})`;
            titleLine2Element.textContent = `TOTAL ${formatNumber(totalPopulation)} orang`;
            summaryCountElement.textContent = `${totalProvinces} Provinsi - ${totalKabkot} Kabupaten/Kota`;

            // Langkah 4: Sortir dan Siapkan data (sama)
            allProvincesData = Object.entries(provinces)
                .map(([name, data]) => {
                    data.cities.sort((a, b) => a.name.localeCompare(b.name));
                    return { name, ...data };
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            // Langkah 5: Render daftar provinsi awal (sama)
            renderProvinceList(allProvincesData);

             // Hapus pesan loading setelah selesai render
             if(loadingMessage) loadingMessage.remove();


        } catch (error) {
            console.error("Gagal memuat atau memproses data:", error);
            // Tampilkan pesan error di tempat loading message
             if(loadingMessage) {
                 loadingMessage.textContent = 'Gagal memuat data penduduk. Silakan coba lagi nanti.';
                 loadingMessage.classList.add('error-message'); // Tambah class error jika ada
                 loadingMessage.classList.remove('loading-message');
             } else { // Jika loading message tidak ada, tambahkan pesan error ke container
                 provinceListContainer.innerHTML = '<p class="error-message">Gagal memuat data penduduk. Silakan coba lagi nanti.</p>';
             }
            titleLine1Element.textContent = "Gagal Memuat Data";
            titleLine2Element.textContent = "";
            summaryCountElement.textContent = "Gagal memuat ringkasan";
        }
    }

    // --- Fungsi renderProvinceList TIDAK BERUBAH ---
    function renderProvinceList(provincesToRender) {
        // Pastikan container bersih sebelum render
        provinceListContainer.innerHTML = '';
        if (provincesToRender.length === 0) {
             provinceListContainer.innerHTML = '<p class="no-results-message">Tidak ada data provinsi yang cocok ditemukan.</p>';
             return;
        }
        provincesToRender.forEach(prov => {
            const provinceItem = document.createElement('div');
            provinceItem.classList.add('province-item');
            provinceItem.dataset.provinceName = prov.name.toLowerCase();
            const provinceHeader = document.createElement('div');
            provinceHeader.classList.add('province-header');
            provinceHeader.innerHTML = `<span class="province-name">${prov.name}</span><span class="province-total">Total: ${formatNumber(prov.totalPenduduk)} jiwa</span>`;
            const cityList = document.createElement('ul');
            cityList.classList.add('city-list');
            prov.cities.forEach(city => {
                const cityItem = document.createElement('li');
                cityItem.classList.add('city-item');
                cityItem.dataset.cityName = city.name.toLowerCase();
                cityItem.innerHTML = `<span class="city-name">${city.name}</span><span class="city-population">${formatNumber(city.population)} <span class="city-year">(${city.year || 'N/A'})</span></span>`;
                cityList.appendChild(cityItem);
            });
            provinceHeader.addEventListener('click', () => { provinceItem.classList.toggle('expanded'); });
            provinceItem.appendChild(provinceHeader);
            provinceItem.appendChild(cityList);
            provinceListContainer.appendChild(provinceItem);
        });
    }


    // --- Fungsi handleSearch TIDAK BERUBAH ---
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const allProvinceItems = provinceListContainer.querySelectorAll('.province-item');
        let visibleCount = 0;

        provinceListContainer.querySelectorAll('.city-item.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });

         const existingNoResultsMsg = provinceListContainer.querySelector('.no-results-message');
         if (existingNoResultsMsg) {
             existingNoResultsMsg.remove();
         }

        allProvinceItems.forEach(item => {
            const provinceName = item.dataset.provinceName;
            const cityItems = item.querySelectorAll('.city-item');
            let provinceNameMatches = provinceName.includes(searchTerm);
            let cityMatchFound = false;

            cityItems.forEach(cityLi => {
                const cityName = cityLi.dataset.cityName;
                if (searchTerm !== '' && cityName.includes(searchTerm)) {
                    cityLi.classList.add('highlighted');
                    cityMatchFound = true;
                }
            });

            const shouldBeVisible = provinceNameMatches || cityMatchFound;

            if (shouldBeVisible) {
                item.classList.remove('hidden');
                visibleCount++;
                if (cityMatchFound && searchTerm !== '') {
                    item.classList.add('expanded');
                } else {
                     if (searchTerm !== '' && !cityMatchFound && provinceNameMatches) {
                         item.classList.remove('expanded');
                     }
                }
            } else {
                item.classList.add('hidden');
                item.classList.remove('expanded');
            }
        });

        if (visibleCount === 0 && searchTerm !== '') {
           const msgElement = document.createElement('p');
           msgElement.classList.add('no-results-message');
           msgElement.textContent = 'Tidak ada provinsi atau kabupaten/kota yang cocok ditemukan.';
           // Cek jika container kosong sebelum menambah
           if (provinceListContainer.children.length === 0 || provinceListContainer.firstElementChild.classList.contains('province-item')) {
                provinceListContainer.insertBefore(msgElement, provinceListContainer.firstChild);
           } else if (!provinceListContainer.querySelector('.no-results-message')){
               // Jika sudah ada elemen lain (selain item provinsi) dan belum ada pesan error, tambahkan
               provinceListContainer.appendChild(msgElement);
           }
        }
    }

    // Listener dan pemanggilan awal (TIDAK BERUBAH)
    searchInput.addEventListener('input', handleSearch);
    fetchDataAndRender();
});
