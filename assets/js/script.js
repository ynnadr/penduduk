document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('main-title');
    const provinceListContainer = document.getElementById('province-list');
    const searchInput = document.getElementById('search-input');
    const loadingMessage = document.querySelector('.loading-message');

    const dataUrl = 'data/penduduk.json';
    let allProvincesData = []; // Simpan data asli untuk filtering

    // Fungsi untuk format angka Indonesia
    function formatNumber(num) {
        return num.toLocaleString('id-ID');
    }

    // Fungsi untuk mengambil dan memproses data
    async function fetchDataAndRender() {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawData = await response.json();

            // Proses data: Grouping, Summing, Min/Max Year
            const provinces = {};
            let totalPopulation = 0;
            let minYear = Infinity;
            let maxYear = -Infinity;

            rawData.forEach(item => {
                // Pastikan data penduduk valid
                const population = parseInt(item.penduduk) || 0;
                totalPopulation += population;

                const year = parseInt(item.tahun) || 0;
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
                    name: item.kabkot || "Kab/Kota Tidak Diketahui",
                    population: population,
                    year: year
                });
            });

             // Setelah loop, ganti Infinity jika tidak ada tahun valid
             if (minYear === Infinity) minYear = "N/A";
             if (maxYear === -Infinity) maxYear = "N/A";

            // Update Judul Halaman
            titleElement.textContent = `Data Penduduk Indonesia (${minYear} - ${maxYear}) TOTAL ${formatNumber(totalPopulation)} orang`;

            // Sortir kota dalam provinsi & siapkan data provinsi untuk dirender
            allProvincesData = Object.entries(provinces)
                .map(([name, data]) => {
                    // Sortir kota berdasarkan nama
                    data.cities.sort((a, b) => a.name.localeCompare(b.name));
                    return { name, ...data };
                })
                // Sortir provinsi berdasarkan nama
                .sort((a, b) => a.name.localeCompare(b.name));

            // Render daftar provinsi awal
            renderProvinceList(allProvincesData);

        } catch (error) {
            console.error("Gagal memuat atau memproses data:", error);
            provinceListContainer.innerHTML = '<p class="error-message">Gagal memuat data penduduk. Silakan coba lagi nanti.</p>';
            titleElement.textContent = "Gagal Memuat Data";
        }
    }

    // Fungsi untuk merender daftar provinsi ke HTML
    function renderProvinceList(provincesToRender) {
        // Hapus pesan loading atau konten lama
        provinceListContainer.innerHTML = '';

        if (provincesToRender.length === 0) {
             provinceListContainer.innerHTML = '<p class="no-results-message">Tidak ada data provinsi yang cocok ditemukan.</p>';
             return;
        }

        provincesToRender.forEach(prov => {
            const provinceItem = document.createElement('div');
            provinceItem.classList.add('province-item');
            provinceItem.dataset.provinceName = prov.name.toLowerCase(); // Untuk search

            // Header Provinsi (Nama + Total Penduduk)
            const provinceHeader = document.createElement('div');
            provinceHeader.classList.add('province-header');
            provinceHeader.innerHTML = `
                <span class="province-name">${prov.name}</span>
                <span class="province-total">Total: ${formatNumber(prov.totalPenduduk)} jiwa</span>
            `;

            // Daftar Kabupaten/Kota (Awalnya tersembunyi)
            const cityList = document.createElement('ul');
            cityList.classList.add('city-list');

            prov.cities.forEach(city => {
                const cityItem = document.createElement('li');
                cityItem.classList.add('city-item');
                cityItem.dataset.cityName = city.name.toLowerCase(); // Untuk search
                cityItem.innerHTML = `
                    <span class="city-name">${city.name}</span>
                    <span class="city-population">${formatNumber(city.population)} <span class="city-year">(${city.year || 'N/A'})</span></span>
                `;
                cityList.appendChild(cityItem);
            });

            // Tambahkan event listener untuk toggle
            provinceHeader.addEventListener('click', () => {
                provinceItem.classList.toggle('expanded');
            });

            provinceItem.appendChild(provinceHeader);
            provinceItem.appendChild(cityList);
            provinceListContainer.appendChild(provinceItem);
        });
    }

    // Fungsi untuk handle pencarian
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const allItems = provinceListContainer.querySelectorAll('.province-item');
        let visibleCount = 0;

        allItems.forEach(item => {
            const provinceName = item.dataset.provinceName;
            const cityNames = Array.from(item.querySelectorAll('.city-item'))
                                 .map(li => li.dataset.cityName);

            // Cek kecocokan dengan nama provinsi ATAU salah satu nama kota/kab
            const isMatch = provinceName.includes(searchTerm) ||
                            cityNames.some(cityName => cityName.includes(searchTerm));

            if (isMatch) {
                item.classList.remove('hidden');
                visibleCount++;
            } else {
                item.classList.add('hidden');
            }
        });

        // Tampilkan pesan jika tidak ada hasil
         const noResultsMsg = provinceListContainer.querySelector('.no-results-message');
         if (visibleCount === 0 && searchTerm !== '') {
             if (!noResultsMsg) { // Hanya tambahkan jika belum ada
                 const msgElement = document.createElement('p');
                 msgElement.classList.add('no-results-message');
                 msgElement.textContent = 'Tidak ada provinsi atau kabupaten/kota yang cocok ditemukan.';
                 // Sisipkan di awal agar terlihat jelas
                 provinceListContainer.insertBefore(msgElement, provinceListContainer.firstChild);
             }
         } else {
             if (noResultsMsg) {
                 noResultsMsg.remove(); // Hapus pesan jika ada hasil atau input kosong
             }
         }
    }

    // Tambahkan event listener ke input search
    searchInput.addEventListener('input', handleSearch);

    // Mulai ambil dan render data saat halaman siap
    fetchDataAndRender();
});
