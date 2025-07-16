import {defineStore} from "pinia";
import departments from "../json/departamentos.json";
import stadiums from "../json/estadios.json";
import dealership from "../json/concesiones.json";
import clubservices from "../json/servicios.json";
import {Box} from "@/models/Box";
import {Department} from "@/models/Department";
import {Stadium} from "@/models/Stadium";
import {ClubService} from "@/models/ClubService";
import {Dealership} from "@/models/Dealership";
import {Property} from "@/models/Property";


export const useBoxStore = defineStore('box', {
    state: () => ({
        current: new Box(1, departments[0]),
        boxes: {
            top: [
                new Box(21, new Department(departments[6])),
                new Box(22, new Stadium(stadiums[11])),
                new Box(23, new Department(departments[7])),
                new Box(24, new Stadium(stadiums[12])),
                new Box(25, new Stadium(stadiums[13])),
                new Box(26, new Dealership(dealership[2])),
                new Box(27, new Stadium(stadiums[14])),
                new Box(28, new Stadium(stadiums[15])),
                new Box(29, new ClubService(clubservices[1])),
                new Box(30, new Stadium(stadiums[16])),
                new Box(31, new Stadium(stadiums[17])),
                new Box(32, new Department(departments[8])),
                new Box(33, new Department(departments[9])),
            ],
            left: [
                new Box(20, new Stadium(stadiums[10])),
                new Box(19, new Department(departments[5])),
                new Box(18, new Stadium(stadiums[9])),
                new Box(17, new Stadium(stadiums[8])),
                new Box(16, new Dealership(dealership[1])),
                new Box(15, new Stadium(stadiums[7])),
                new Box(14, new Stadium(stadiums[6])),
            ],
            right: [
                new Box(34, new Stadium(stadiums[18])),
                new Box(35, new Stadium(stadiums[19])),
                new Box(36, new Dealership(dealership[3])),
                new Box(37, new Department(departments[10])),
                new Box(38, new Stadium(stadiums[20])),
                new Box(39, new Department(departments[11])),
                new Box(40, new Stadium(stadiums[21])),
            ],
            bottom: [
                new Box(13, new Department(departments[4])),
                new Box(12, new ClubService(clubservices[0])),
                new Box(11, new Stadium(stadiums[5])),
                new Box(10, new Stadium(stadiums[4])),
                new Box(9, new Department(departments[3])),
                new Box(8, new Stadium(stadiums[3])),
                new Box(7, new Stadium(stadiums[2])),
                new Box(6, new Dealership(dealership[0])),
                new Box(5, new Department(departments[2])),
                new Box(4, new Stadium(stadiums[1])),
                new Box(3, new Department(departments[1])),
                new Box(2, new Stadium(stadiums[0])),
                new Box(1, new Department(departments[0])),
            ]
        } as const,
    }),
    actions: {
        updateCurrent(value: number) {
            this.current = <Box>Object.values(this.boxes).flat().find(b => b.id == value);
        },
        playerPos(value: number): Box {
            return <Box>Object.values(this.boxes).flat().find(b => b.id == value);
        }
    },
    getters: {
        getPropertyOrDepartment(): Property | Department {
            return this.current.kind;
        }
    }
})