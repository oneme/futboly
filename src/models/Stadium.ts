import {Property} from "./Property";
export interface IColors {
    top: string;
    bottom: string;
    style: number;
}

export class Stadium extends Property {
    team : string;
    build : number;
    chairs : number;
    colors: IColors

    constructor(stadium: any) {
        super(stadium);
        this.team = stadium.team;
        this.build = stadium.build;
        this.chairs = 0;
        this.colors = stadium.colors;
    }

    buildAction(qty: number): void {
        this.chairs += qty;
    }
    teardown(qty: number): void {
        this.chairs -= qty;
    }

    rent(grouped: boolean): number {
        let result = 0;
        if (!this.mortgaged) {
            if (this.chairs == 0) {
                result = grouped ? this.rents[0].rent * 2 : this.rents[0].rent;
            } else {
                result = this.rents[this.chairs].rent;
            }
        }
        console.log(`rent was: ${result}`);
        return result;
    }
}