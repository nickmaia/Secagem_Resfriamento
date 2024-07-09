document.getElementById('calcular').addEventListener('click', function() {
    const tempo = document.getElementById('tempo').value.split(',').map(Number);
    const peso = document.getElementById('peso').value.split(',').map(Number);
    const pesoSeco = parseFloat(document.getElementById('peso_seco').value);
    const area = parseFloat(document.getElementById('area').value);
    const umidadeInicio = parseFloat(document.getElementById('umidade_inicio').value);
    const umidadeFinal = parseFloat(document.getElementById('umidade_final').value);

    const curva = new CurvaSecagem(tempo, peso, pesoSeco, area);
    const tabela = curva.getTable();
    displayTable(tabela);
    curva.plotarTaxas();
    const [integralContinua, integralDiscreta] = curva.getTime(umidadeInicio, umidadeFinal);
    displayIntegrals(integralContinua, integralDiscreta);
});

class CurvaSecagem {
    constructor(tempo, peso, pesoSeco, area) {
        this.tempo = tempo;
        this.peso = peso;
        this.pesoSeco = pesoSeco;
        this.area = area;
        
        this.massaAgua = peso.map(p => p - pesoSeco);
        this.teorUmidade = this.massaAgua.map(m => m / pesoSeco);
        this.teorUmidadeEquilibrio = this.teorUmidade[this.teorUmidade.length - 1];
        this.teorUmidadeRelativa = this.teorUmidade.map(t => t - this.teorUmidadeEquilibrio);
        this.teorUmidadeMedia = this.teorUmidadeRelativa.map((t, i, arr) => (arr[i] + (arr[i + 1] || t)) / 2);
        
        this.dxdtDiscreta = this.teorUmidade.map((t, i, arr) => (arr[i + 1] - t) / (this.tempo[i + 1] - this.tempo[i])).slice(0, -1);
        this.dxdtContinua = this.getDerivativePoly2(this.tempo, this.teorUmidade);
        
        this.RaDiscreta = this.dxdtDiscreta.map(d => -pesoSeco * d / area);
        this.RaContinua = this.dxdtContinua.map(d => -pesoSeco * d / area);
    }

    getDerivativePoly2(x, y) {
        const polinomio = polyfit(x, y, 2);
        const derivadaPolinomio = polider(polinomio);
        return polyval(derivadaPolinomio, x);
    }

    getTable() {
        return {
            'Tempo (t)': this.tempo,
            'Peso (W)': this.peso,
            'Massa água (Wa)': this.massaAgua,
            'Teor umidade (Xt)': this.teorUmidade,
            'Teor umidade relativa (X)': this.teorUmidadeRelativa,
            'Teor umidade media (Xm)': this.teorUmidadeMedia,
            'dX/dt discreta': this.dxdtDiscreta,
            'dX/dt continua': this.dxdtContinua,
            'Taxa de secagem discreta (Ra)': this.RaDiscreta,
            'Taxa de secagem continua (Ra)': this.RaContinua
        };
    }

    plotarTaxas() {
        const trace1 = {
            x: this.teorUmidadeMedia,
            y: this.RaDiscreta,
            mode: 'lines+markers',
            name: 'Taxa de secagem discreta (Ra)',
            line: { dash: 'dash', color: 'red' },
            marker: { color: 'red' }
        };
        
        const trace2 = {
            x: this.teorUmidadeMedia,
            y: this.RaContinua,
            mode: 'lines+markers',
            name: 'Taxa de secagem continua (Ra)',
            line: { dash: 'solid', color: 'blue' },
            marker: { color: 'blue' }
        };
        
        const layout = {
            title: 'Taxa de Secagem vs Teor de Umidade Média',
            xaxis: { title: 'Teor de Umidade Média (Xm)' },
            yaxis: { title: 'Taxa de Secagem (Ra)' }
        };
        
        Plotly.newPlot('plot', [trace1, trace2], layout);
    }

    getTime(teorUmidadeInicio, teorUmidadeFinal) {
        const x = this.teorUmidadeMedia;
        const yContinua = this.RaContinua.map(r => this.pesoSeco / (this.area * r));
        const yDiscreta = this.RaDiscreta.map(r => this.pesoSeco / (this.area * r));
        
        const xNew = linspace(teorUmidadeFinal, teorUmidadeInicio, 1000);
        const yNewContinua = interp1(x, yContinua, xNew);
        const yNewDiscreta = interp1(x, yDiscreta, xNew);
        
        const integralContinua = trapz(yNewContinua, xNew);
        const integralDiscreta = trapz(yNewDiscreta, xNew);
        
        return [integralContinua, integralDiscreta];
    }
}

function displayTable(data) {
    const output = document.getElementById('output');
    output.innerHTML = '<h2>Resultados</h2>';
    const table = document.createElement('table');
    table.classList.add('results-table');

    for (const [key, values] of Object.entries(data)) {
        const row = document.createElement('tr');
        const cellKey = document.createElement('td');
        cellKey.textContent = key;
        row.appendChild(cellKey);
        const cellValues = document.createElement('td');
        cellValues.textContent = values.join(', ');
        row.appendChild(cellValues);
        table.appendChild(row);
    }
    output.appendChild(table);
}

function displayIntegrals(continua, discreta) {
    const output = document.getElementById('output');
    const p = document.createElement('p');
    p.innerHTML = `
        <strong>Tempo (t) pela taxa continua:</strong> ${continua.toFixed(2)}<br>
        <strong>Tempo (t) pela taxa discreta:</strong> ${discreta.toFixed(2)}
    `;
    output.appendChild(p);
}

function polyfit(x, y, degree) {
    const m = x.length;
    const X = [];
    for (let i = 0; i < m; i++) {
        const row = [];
        for (let j = 0; j <= degree; j++) {
            row.push(Math.pow(x[i], degree - j));
        }
        X.push(row);
    }
    const XT = transpose(X);
    const XTX = multiply(XT, X);
    const invXTX = inverse(XTX);
    const XTy = multiply(XT, y);
    return multiply(invXTX, XTy);
}

function polider(poly) {
    const degree = poly.length - 1;
    return poly.slice(0, -1).map((c, i) => c * (degree - i));
}

function polyval(poly, x) {
    return x.map(xi => poly.reduce((acc, c, i) => acc + c * Math.pow(xi, poly.length - 1 - i), 0));
}

function interp1(x, y, xNew) {
    return xNew.map(xi => {
        let i = 1;
        while (i < x.length && xi > x[i]) i++;
        const x0 = x[i - 1], x1 = x[i];
        const y0 = y[i - 1], y1 = y[i];
        return y0 + (y1 - y0) * (xi - x0) / (x1 - x0);
    });
}

function linspace(start, end, num) {
    const step = (end - start) / (num - 1);
    return Array.from({ length: num }, (_, i) => start + i * step);
}

function transpose(matrix) {
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

function multiply(a, b) {
    const m = a.length, n = b[0].length, p = b.length;
    const result = Array.from({ length: m }, () => Array(n).fill(0));
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            for (let k = 0; k < p; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }
    return result;
}

function inverse(matrix) {
    const size = matrix.length;
    const augmented = matrix.map((row, i) => [...row, ...Array(size).fill(0).map((_, j) => (i === j ? 1 : 0))]);
    for (let i = 0; i < size; i++) {
        const factor = augmented[i][i];
        for (let j = 0; j < size * 2; j++) {
            augmented[i][j] /= factor;
        }
        for (let k = 0; k < size; k++) {
            if (k === i) continue;
            const factor = augmented[k][i];
            for (let j = 0; j < size * 2; j++) {
                augmented[k][j] -= factor * augmented[i][j];
            }
        }
    }
    return augmented.map(row => row.slice(size));
}

function trapz(y, x) {
    let sum = 0;
    for (let i = 0; i < y.length - 1; i++) {
        sum += 0.5 * (y[i + 1] + y[i]) * (x[i + 1] - x[i]);
    }
    return sum;
}
