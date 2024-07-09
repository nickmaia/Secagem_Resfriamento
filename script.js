document.getElementById('calcular').addEventListener('click', function() {
    const tempo = document.getElementById('tempo').value.split(',').map(Number);
    const peso = document.getElementById('peso').value.split(',').map(Number);
    const pesoSeco = parseFloat(document.getElementById('peso_seco').value);
    const area = parseFloat(document.getElementById('area').value);
    const umidadeInicio = parseFloat(document.getElementById('umidade_inicio').value);
    const umidadeFinal = parseFloat(document.getElementById('umidade_final').value);

    const curva = new CurvaSecagem(tempo, peso, pesoSeco, area);
    curva.plotarTaxas();
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
        const polinomio = this.polyfit(x, y, 2);
        const derivadaPolinomio = this.polider(polinomio);
        return this.polyval(derivadaPolinomio, x);
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

    polyfit(x, y, degree) {
        const m = x.length;
        const X = [];
        for (let i = 0; i < m; i++) {
            const row = [];
            for (let j = 0; j <= degree; j++) {
                row.push(Math.pow(x[i], degree - j));
            }
            X.push(row);
        }
        const XT = this.transpose(X);
        const XTX = this.multiply(XT, X);
        const invXTX = this.inverse(XTX);
        const XTy = this.multiply(XT, y);
        return this.multiply(invXTX, XTy);
    }

    polider(poly) {
        const degree = poly.length - 1;
        return poly.slice(0, -1).map((c, i) => c * (degree - i));
    }

    polyval(poly, x) {
        return x.map(xi => poly.reduce((acc, c, i) => acc + c * Math.pow(xi, poly.length - 1 - i), 0));
    }

    transpose(matrix) {
        return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
    }

    multiply(a, b) {
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

    inverse(matrix) {
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
}
