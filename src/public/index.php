<!doctype html>
<html lang="en">

<head>
    <title>Title</title>
    <!-- Required meta tags -->
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

    <!-- JS for jQuery -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>
    <!-- Bootstrap CSS v5.2.1 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous" />
    <!-- FontAwesome 6.2.0 CSS -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css" integrity="sha512-xh6O/CkQoPOWDdYTDqeRdPCVd1SpvCA9XXcUnZS2FmJNp1coAFzvtCN9BmamE+4aHK8yyUHUSCcJHgXloTyT2A==" crossorigin="anonymous" referrerpolicy="no-referrer" />

    <!-- (Optional) Use CSS or JS implementation -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/js/all.min.js" integrity="sha512-naukR7I+Nk6gp7p5TMA4ycgfxaZBJ7MO5iC3Fp6ySQyKFHOGfpkSZkYVWV5R7u7cfAicxanwYQ5D1e17EfJcMA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

    <!-- <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js"></script> -->
    <script src="https://cdn.jsdelivr.net/npm/fullcalendar-scheduler@6.1.10/index.global.min.js"></script>
    <script src='fullcalendar/dist/index.global.js'></script>

    <link rel="stylesheet" href="./styles/style.css">
</head>



<body>
    <div class="container-fluid">
        <div class="row flex-nowrap">
            <div class="bg-dark col-2 min-vh-100 d-flex flex-column justify-content-between navbar">
                <div class="bg-dark p-2">
                    <a href="" class="d-flex text-decoration-none mt-1 align-items-center text-white">
                        <span class="fs-4 d-none d-sm-inline">SideMenu</span>
                    </a>
                    <ul class="nav nav-pills flex-column mt-4 ">
                        <li class="nav-item py-2 py-sm-0">
                            <a href="#" class="nav-link text-white">
                                <i class="fs-5 fa fa-chart-bar"></i><span class="fs-4 ms-3 d-none d-sm-inline">Dashboard</span>
                            </a>
                        </li>
                        <li class="nav-item py-2 py-sm-0">
                            <a href="#" class="nav-link text-white">
                                <i class="fs-5 fa fa-house"></i><span class="fs-4 ms-3 d-none d-sm-inline">Home</span>
                            </a>
                        </li>
                        <li class="nav-item py-2 py-sm-0">
                            <a href="#" class="nav-link text-white">
                                <i class="fs-5 fa fa-table-list"></i><span class="fs-4 ms-3 d-none d-sm-inline">Calendario</span>
                            </a>
                        </li>
                        <li class="nav-item py-2 py-sm-0">
                            <a href="#" class="nav-link text-white">
                                <i class="fs-5 fa fa-table-list"></i><span class="fs-4 ms-3 d-none d-sm-inline">Habitaciones</span>
                            </a>
                        </li>
                        <li class="nav-item py-2 py-sm-0">
                            <a href="#" class="nav-link text-white">
                                <i class="fs-5 fa fa-users"></i><span class="fs-4 ms-3 d-none d-sm-inline">Tarifas</span>
                            </a>
                        </li>
                    </ul>

                </div>
                <div class="dropdown open p-3">
                    <button class="btn border-none dropdown-toggle text-white" type="button" id="triggerId" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        <i class="fa fa-user"></i><span class="ms-2">Efren</span>
                    </button>
                    <div class="dropdown-menu" aria-labelledby="triggerId">
                        <button class="dropdown-item" href="#">Setting</button>
                        <button class="dropdown-item" href="#">Profile</button>
                    </div>
                </div>
            </div>
            <!-- Content -->
            <div class="col content"></div>
            <div class="calendar-container">
                <div class="calendar-header">
                    <div class="bg-dark mb-3">
                        <a name="" id="crear-reserva-btn" class="btn btn-secondary btn-sm m-3" href="#" role="button" data-bs-toggle="modal" data-bs-target="#event_entry_modal">Crear reserva</a>
                    </div>


                </div>
                <div id='calendar'></div>
            </div>
        </div>
    </div>

    <!-- Modals -->

    <div class="modal fade" id="event_entry_modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">Crear reserva</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close" aria-hidden="true">&times;</button>

                </div>
                <div class="modal-body">
                    <div class="img-container">
                        <div class="row mt-2">
                            <div class="col-sm-5">
                                <div class="form-group">
                                    <label for="event_start_date">Fecha llegada</label>
                                    <input type="date" name="event_start_date" id="event_start_date" class="form-control onlydatepicker" placeholder="Event start date">
                                </div>
                            </div>
                            <div class="col-sm-5">
                                <div class="form-group">
                                    <label for="event_end_date">Fecha salida</label>
                                    <input type="date" name="event_end_date" id="event_end_date" class="form-control" placeholder="Event end date">
                                </div>
                            </div>
                            <div class="col-sm-2">
                                <div class="form-group">
                                    <label for="event_end_date">Noches: </label>
                                    <input type="number" name="event_end_date" id="event_end_date" class="form-control" placeholder="" min="1">
                                </div>
                            </div>
                        </div>
                        <h3 class="mt-3">Habitación</h3>
                        <div class="row">
                            <div class="col-sm-4">
                                <div class="form-group">
                                    <label for="tipologia_habitacion">Tipología</label>
                                    <input type="select" name="tipologia_habitacion" id="tipologia_habitacion" class="form-control onlydatepicker" placeholder="Tipología">
                                </div>
                            </div>

                            <div class="col-sm-4">
                                <div class="form-group">
                                    <label for="ocupacion_habitacion">Ocupación Máx.</label>
                                    <input type="number" name="ocupacion_habitacion" id="ocupacion_habitacion" class="form-control onlydatepicker" placeholder="Ocupación">
                                </div>
                            </div>

                            <div class="col-sm-4">
                                <div class="form-group">
                                    <label for="ocupacion_habitacion"></label>
                                    <div class="input-group">
                                        <div class="input-group-prepend">
                                            <span class="input-group-text">Unidades: </span>
                                        </div>
                                        <input type="number" class="form-control" aria-label="Unidades" min="1" step="any" max="1" value="1">
                                    </div>
                                </div>
                            </div>
                        </div> <!-- Cierre row -->

                        <div class="row mt-2">
                            <div class="col-sm-6">
                                <div class="form-group">
                                    <label for="ocupacion_habitacion">Total</label>
                                    <div class="input-group ig-shopping-price mb-3">
                                        <input type="number" class="form-control" id="center-input" aria-label="Amount (to the nearest dollar)" min="0.00" placeholder="Total">
                                        <div class="input-group-append">
                                            <span class="input-group-text">$ M.N.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-sm-6">
                                <div class="form-group">
                                    <label for="ocupacion_habitacion">Descuento</label>
                                    <div class="input-group ig-shopping-price mb-3">
                                        <input type="number" class="form-control" id="center-input" aria-label="Descuento" min="0.00" placeholder="Descuento">
                                        <div class="input-group-append">
                                            <span class="input-group-text"> % </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div> <!-- Cierre row -->

                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="save-event-btn">Save Event</button>
                </div>
            </div>
        </div>
    </div>
    <!-- End popup dialog box -->





    <!-- Bootstrap JavaScript Libraries -->
    <script src="./scripts/calendar.js"></script>
    <script src="./scripts/functions.js"></script>



    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js" integrity="sha384-I7E8VVD/ismYTF4hNIPjVp/Zjvgyol6VFvRkX/vR+Vc4jQkC+hVqc2pM8ODewa9r" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.min.js" integrity="sha384-BBtl+eGJRgqQAUMxJ7pMwbEyER4l1g+O15P+16Ep7Q9Q+zqX6gSbd85u4mG4QzX+" crossorigin="anonymous"></script>
</body>

</html>