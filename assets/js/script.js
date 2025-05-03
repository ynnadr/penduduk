document.addEventListener('DOMContentLoaded', () => {
    // Ambil elemen judul baru
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const provinceListContainer = document.getElementById('province-list');
    const searchInput = document.getElementById('search-input');
    const loadingMessage = document.querySelector('.loading-message');

    const dataUrl = 'data/penduduk.json';
    let allProvincesData = [];

    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) {
            return '0';
        }
        return num.toLocaleString('id-ID');
    }

    async function fetchDataAndRender() {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawData = await response.json();

            // Langkah 1: Filter data terbaru per kabkot (sama seperti sebelumnya)
            const latestEntries = {};
            rawData.forEach(item => {
                const kabkot = (item.kabkot || "Unknown").trim();
                const year = parseInt(item.tahun) || 0;
                if (!latestEntries[kabkot] || year > latestEntries[kabkot].tahun) {
                    latestEntries[kabkot] = { ...item, tahun: year };
                }
            });
            const latestData = Object.values(latestEntries);

            // Langkah 2: Proses data terbaru (sama seperti sebelumnya)
            const provinces = {};
            let totalPopulation = 0;
            let minYear = Infinity;
            let maxYear = -Infinity;
            latestData.forEach(item => {
                const population = parseInt(item.penduduk) || 0;
                totalPopulation += population;
                const year = item.tahun;
                 if (year > 0) {
                    minYear = Math.min(minYear, year);
                    maxYear = Math.max(maxYear, year);
                 }
                const provinceName = item.prov || "Provinsi Tidak Diketahui";
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

            // --- PERUBAHAN: Update Judul Halaman (Split Lines) ---
            titleLine1Element.textContent = `Data Penduduk Indonesia (${minYear} - ${maxYear})`;
            titleLine2Element.textContent = `TOTAL ${formatNumber(totalPopulation)} orang`;
            // Info sumber dan tanggal download sudah ada di HTML statis

            // Langkah 4: Sortir dan Siapkan data (sama)
            allProvincesData = Object.entries(provinces)
                .map(([name, data]) => {
                    data.cities.sort((a, b) => a.name.localeCompare(b.name));
                    return { name, ...data };
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            // Langkah 5: Render daftar provinsi awal (sama)
            renderProvinceList(allProvincesData);

        } catch (error) {
            console.error("Gagal memuat atau memproses data:", error);
            provinceListContainer.innerHTML = '<p class="error-message">Gagal memuat data penduduk. Silakan coba lagi nanti.</p>';
            // Update kedua baris judul jika error
            titleLine1Element.textContent = "Gagal Memuat Data";
            titleLine2Element.textContent = "";
        }
    }

    // Fungsi renderProvinceList (TIDAK BERUBAH)
     function renderProvinceList(provincesToRender) {
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


    // --- PERUBAHAN: Fungsi handleSearch dengan Auto-Expand dan Highlight ---
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const allProvinceItems = provinceListContainer.querySelectorAll('.province-item');
        let visibleCount = 0;

        // Hapus highlight sebelumnya dari SEMUA city-item
        provinceListContainer.querySelectorAll('.city-item.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });

        // Hapus pesan 'tidak ada hasil' sebelumnya jika ada
         const existingNoResultsMsg = provinceListContainer.querySelector('.no-results-message');
         if (existingNoResultsMsg) {
             existingNoResultsMsg.remove();
         }

        allProvinceItems.forEach(item => {
            const provinceName = item.dataset.provinceName;
            const cityItems = item.querySelectorAll('.city-item');
            let provinceNameMatches = provinceName.includes(searchTerm);
            let cityMatchFound = false; // Flag apakah ada kota yg cocok di provinsi ini

            // Iterasi KOTA untuk cek kecocokan dan highlight
            cityItems.forEach(cityLi => {
                const cityName = cityLi.dataset.cityName;
                if (searchTerm !== '' && cityName.includes(searchTerm)) {
                    cityLi.classList.add('highlighted'); // Highlight kota yang cocok
                    cityMatchFound = true; // Set flag
                }
                 // Tidak perlu remove highlight di sini karena sudah dibersihkan di awal
            });

            // Tentukan visibilitas item provinsi
            const shouldBeVisible = provinceNameMatches || cityMatchFound;

            if (shouldBeVisible) {
                item.classList.remove('hidden');
                visibleCount++;
                // Auto-expand JIKA ada KOTA yang cocok DAN ada teks pencarian
                if (cityMatchFound && searchTerm !== '') {
                    item.classList.add('expanded');
                } else {
                    // Jika HANYA nama provinsi yang cocok, JANGAN auto-expand
                    // Jika search term kosong, jangan ubah status expand (biarkan user yg kontrol)
                     if (searchTerm !== '' && !cityMatchFound && provinceNameMatches) {
                         item.classList.remove('expanded'); // Tutup jika hanya provinsi yg cocok
                     }
                }
            } else {
                item.classList.add('hidden');
                item.classList.remove('expanded'); // Selalu tutup jika disembunyikan
            }
        });

        // Tampilkan pesan jika tidak ada hasil setelah loop
        if (visibleCount === 0 && searchTerm !== '') {
           const msgElement = document.createElement('p');
           msgElement.classList.add('no-results-message');
           msgElement.textContent = 'Tidak ada provinsi atau kabupaten/kota yang cocok ditemukan.';
           provinceListContainer.insertBefore(msgElement, provinceListContainer.firstChild);
        }
    }

    // Tambahkan event listener ke input search (sama)
    searchInput.addEventListener('input', handleSearch);

    // Mulai ambil dan render data saat halaman siap (sama)
    fetchDataAndRender();
});
