
        const { DataFrame } = dfjs;

        function get_derivative_poly2(x, y) {
            let coefficients = numeric.polynomialFit(x, y, 2);
            let derivative = numeric.polynomialDerivative(coefficients);
            return x.map(val => numeric.polynomialValue(derivative, val));
        }

        class CurvaSecagem {
            constructor(tempo, peso, peso_seco, area) {
                this.tempo = tempo;
                this.peso = peso;
                this.peso_seco = peso_seco;
                this.area = area;

                this.massa_agua = numeric.sub(peso, peso_seco);
                this.teor_umidade = numeric.div(this.massa_agua, peso_seco);
                this.teor_umidade_equilibrio = this.massa_agua[this.massa_agua.length - 1] / peso_seco;
                this.teor_umidade_relativa = numeric.sub(this.teor_umidade, this.teor_umidade_equilibrio);
                this.teor_umidade_media = numeric.div(numeric.convolve(this.teor_umidade_relativa, [1, 1]), 2);

                this.dxdt_discreta = numeric.div(numeric.diff(this.teor_umidade), numeric.diff(this.tempo));
                this.dxdt_continua = get_derivative_poly2(this.tempo, this.teor_umidade);

                this.Ra_discreta = numeric.neg(numeric.div(numeric.mul(peso_seco, this.dxdt_discreta), area));
                this.Ra_continua = numeric.neg(numeric.div(numeric.mul(peso_seco, this.dxdt_continua), area));

                this.dicionario = new DataFrame({
                    'Tempo (t)': this.tempo,
                    'Peso (W)': this.peso,
                    'Massa água (Wa)': this.massa_agua,
                    'Teor umidade (Xt)': this.teor_umidade,
                    'Teor umidade relativa (X)': this.teor_umidade_relativa,
                    'Teor umidade media (Xm)': this.teor_umidade_media,
                    'dX/dt discreta': this.dxdt_discreta,
                    'dX/dt continua': this.dxdt_continua,
                    'Taxa de secagem discreta (Ra)': this.Ra_discreta,
                    'Taxa de secagem continua (Ra)': this.Ra_continua,
                });

                this.constantes = { 'Área': this.area, 'Peso seco': this.peso_seco };
            }

            get_table() {
                return this.dicionario;
            }

            get_time(teor_umidade_inicio, teor_umidade_final) {
                let x = this.teor_umidade_media;
                let y_continua = numeric.div(this.peso_seco, numeric.mul(this.area, this.Ra_continua));
                let y_discreta = numeric.div(this.peso_seco, numeric.mul(this.area, this.Ra_discreta));

                let f_continua = linearInterpolator(x.slice(0, -1), y_continua.slice(0, -1));
                let f_discreta = linearInterpolator(x, y_discreta);

                let x_new = numeric.linspace(teor_umidade_final, teor_umidade_inicio, 1000);
                let y_new_continua = x_new.map(f_continua);
                let integral_continua = numeric.trapz(y_new_continua, x_new);

                let y_new_discreta = x_new.map(f_discreta);
                let integral_discreta = numeric.trapz(y_new_discreta, x_new);

                return [integral_continua, integral_discreta];
            }

            plotar_taxas() {
                let df = this.dicionario.toDict();

                let trace1 = {
                    x: df["Teor umidade media (Xm)"],
                    y: df["Taxa de secagem discreta (Ra)"],
                    mode: 'lines+markers',
                    name: 'Taxa de secagem discreta (Ra)',
                    line: { dash: 'dash', color: 'red' },
                    marker: { color: 'red' }
                };

                let trace2 = {
                    x: df["Teor umidade media (Xm)"],
                    y: df["Taxa de secagem continua (Ra)"],
                    mode: 'lines+markers',
                    name: 'Taxa de secagem continua (Ra)',
                    line: { dash: 'solid', color: 'blue' },
                    marker: { color: 'blue' }
                };

                let layout = {
                    title: 'Taxa de Secagem vs Teor de Umidade Média',
                    xaxis: { title: 'Teor de Umidade Média (Xm)' },
                    yaxis: { title: 'Taxa de Secagem (Ra)' },
                    showlegend: true
                };

                let data = [trace1, trace2];
                Plotly.newPlot('output', data, layout);
            }
        }

        function main() {
            let tempo = [0, 0.4, 0.8, 1.4, 2.2, 3, 4.2, 5, 7, 9, 12];
            let peso = [4.944, 4.885, 4.808, 4.699, 4.554, 4.404, 4.241, 4.15, 4.019, 3.978, 3.955];
            let peso_seco = 3.765;
            let area = 0.166;
            let teor_umidade_inicio = 0.2;
            let teor_umidade_final = 0.04;

            let curva = new CurvaSecagem(tempo, peso, peso_seco, area);
            let dicionario = curva.get_table();

            console.log(dicionario);

            curva.plotar_taxas();

            let [integral_continua, integral_discreta] = curva.get_time(teor_umidade_inicio, teor_umidade_final);
            console.log(`Tempo (t) pela taxa continua: ${integral_continua}`);
            console.log(`Tempo (t) pela taxa discreta: ${integral_discreta}`);
        }

        main();
